const jwt = require('jsonwebtoken');

const JWT_SECRET = 'vocabdaily_jwt_secret_key_2024';

function generateToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        username: user.username
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Không tìm thấy token xác thực' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
        }
        req.user = user;
        next();
    });
}

module.exports = {
    generateToken,
    authenticateToken
};
