require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const path = require('path');
const { initDatabase, User, VocabItem } = require('./database');
const { generateToken, authenticateToken } = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
initDatabase();

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Tên người dùng phải có ít nhất 3 ký tự' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
        }

        // Check if email exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email đã được sử dụng' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            email,
            password_hash,
            gemini_api_key: ''
        });

        await newUser.save();

        const tokenInfo = { id: newUser._id.toString(), username: newUser.username, email: newUser.email };
        const token = generateToken(tokenInfo);

        res.json({ token, user: tokenInfo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
        }

        const userInfo = { id: user._id.toString(), username: user.username, email: user.email };
        const token = generateToken(userInfo);

        res.json({ token, user: userInfo });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng' });
        }

        res.json({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            has_gemini_api_key: !!user.gemini_api_key
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
    }
});

// --- Vocab Routes ---
app.get('/api/vocab', authenticateToken, async (req, res) => {
    try {
        const items = await VocabItem.find({ user_id: req.user.id });
        res.json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách từ vựng' });
    }
});

app.post('/api/vocab', authenticateToken, async (req, res) => {
    try {
        const { word, meaning, phonetic, type, example, example_vi, date, tags, status } = req.body;
        
        if (!word || !meaning) {
            return res.status(400).json({ error: 'Từ và nghĩa là bắt buộc' });
        }

        const newItem = new VocabItem({
            user_id: req.user.id,
            word,
            meaning,
            phonetic: phonetic || '',
            type: type || 'other',
            example: example || '',
            example_vi: example_vi || '',
            status: status || 'new',
            date: date || '',
            tags: tags || []
        });

        await newItem.save();
        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi thêm từ vựng mới' });
    }
});

app.put('/api/vocab/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const allowedFields = ['word', 'meaning', 'phonetic', 'type', 'example', 'example_vi', 'status', 'date', 'tags', 'review_count', 'last_reviewed'];
        const updates = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Không có dữ liệu để cập nhật' });
        }

        const updatedItem = await VocabItem.findOneAndUpdate(
            { _id: id, user_id: req.user.id },
            { $set: updates },
            { new: true }
        );

        if (!updatedItem) {
            return res.status(404).json({ error: 'Không tìm thấy từ vựng hoặc không có quyền truy cập' });
        }

        res.json(updatedItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi cập nhật từ vựng' });
    }
});

app.delete('/api/vocab/all', authenticateToken, async (req, res) => {
    try {
        await VocabItem.deleteMany({ user_id: req.user.id });
        res.json({ message: 'Đã xóa tất cả từ vựng' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi xóa từ vựng' });
    }
});

app.delete('/api/vocab/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await VocabItem.deleteOne({ _id: id, user_id: req.user.id });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Không tìm thấy từ vựng hoặc không có quyền truy cập' });
        }

        res.json({ message: 'Xóa từ vựng thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi xóa từ vựng' });
    }
});

app.post('/api/vocab/import', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) {
            return res.status(400).json({ error: 'Dữ liệu import phải là một mảng' });
        }

        let count = 0;
        const docsToInsert = [];

        for (const item of items) {
            if (item.word && item.meaning) {
                docsToInsert.push({
                    user_id: req.user.id,
                    word: item.word,
                    meaning: item.meaning,
                    phonetic: item.phonetic || '',
                    type: item.type || 'other',
                    example: item.example || '',
                    example_vi: item.example_vi || '',
                    status: item.status || 'new',
                    date_added: item.date_added || new Date(),
                    review_count: item.review_count || 0,
                    last_reviewed: item.last_reviewed || ''
                });
                count++;
            }
        }

        if (docsToInsert.length > 0) {
            await VocabItem.insertMany(docsToInsert);
        }

        res.json({ message: `Đã import thành công ${count} từ vựng` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi import từ vựng' });
    }
});

// --- Settings Routes ---
app.put('/api/settings/apikey', authenticateToken, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        await User.updateOne(
            { _id: req.user.id },
            { $set: { gemini_api_key: apiKey || '' } }
        );
        
        res.json({ message: 'Cập nhật API Key thành công' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi cập nhật API Key' });
    }
});

app.get('/api/settings/apikey', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({ apiKey: user ? user.gemini_api_key : '' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi khi lấy API Key' });
    }
});

// --- Static Files & SPA Fallback ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// SPA fallback
app.get('*', (req, res) => {
    // Only fallback for non-API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Không tìm thấy API endpoint' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`VocabDaily Backend initialized successfully.`);
});
