const JWT = require("jsonwebtoken")

const JWT_SECRET = process.env.JWT_SECRET

// Requires a traveller token in the `auth-token` header and puts { id } on req.user.
// Partner (agent) tokens are rejected because they carry no traveller id.
const fetchuser = (req, res, next) => {
    const token = req.header('auth-token')
    if (!token) {
        return res.status(401).json({ success: false, error: 'Please log in to continue' })
    }
    try {
        const data = JWT.verify(token, JWT_SECRET)
        if (!data.user?.id) {
            return res.status(401).json({ success: false, error: 'Please log in with a traveller account' })
        }
        req.user = data.user
        next()
    } catch (error) {
        return res.status(401).json({ success: false, error: 'Your session has expired. Please log in again.' })
    }
}
module.exports = fetchuser;
