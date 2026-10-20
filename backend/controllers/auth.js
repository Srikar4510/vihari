const bcrypt = require('bcryptjs')
const User = require('../models/user')
const JWT = require("jsonwebtoken")
const JWT_SECRET = process.env.JWT_SECRET
const Agent = require('../models/agent');
const { uploadedPath, removeUpload } = require('../middleware/fileUpload');
const Ticket = require('../models/ticket');
const tourTicket = require('../models/tourTickets');
const Admin = require('../models/admin');

// User fields that are safe to send to the browser (never the password hash).
const publicUser = (u) => ({ _id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email, mobile: u.mobile, createdAt: u.createdAt });

// Verifying login credentials
module.exports.verifyUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    // Same message for unknown email and wrong password, so the response doesn't reveal which accounts exist.
    if (!user || !(await bcrypt.compare(password || '', user.password))) {
      return res.status(403).json({ success: false, error: "Invalid email or password" });
    }
    const authToken = JWT.sign({ user: { id: user.id } }, JWT_SECRET);
    res.json({ success: true, authToken, user: publicUser(user) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}



// Signup for new user
module.exports.createUser = async(req,res)=>{
    await User.findOne({ email: req.body.email }).then(async user => {
        if (user) {
          return res.json({ error: "Email already exists!!" })
        }
        else {
         
          // Hashing password
          const salt = await bcrypt.genSalt(10);
          const secPass = await bcrypt.hash(req.body.password,salt) 
          
         await User.create({
            firstName: req.body.firstName,
            lastName:req.body.lastName,
            email: req.body.email,
            mobile:req.body.mobile,
            password: secPass
        }).then(async user => {

          // Creating authToken for user
          const data ={
            user:{
              id:user.id
            }
          }
          const authToken = await JWT.sign(data,JWT_SECRET)
          res.json({success:true,authToken,user})
  
        }).catch((error) => {
            console.log(error);
            res.json({error:"Internal server error"});
          })
        }
      })
  
}

// Fetching user details
module.exports.getUserDetails = async(req,res)=>{
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (user) {
      return res.json({ success: true, user: publicUser(user) });
    }

    return res.json({ success: false, error: "User not found" });
  } catch (error) {
    console.error("Error in getUserDetails:", error);
    return res.status(500).json({ success: false, error: "Something went wrong" });
  }
}
// Getting user booking history
module.exports.getBookings = async(req,res)=>{
  try {
    const user = req.user;
    const tickets = await Ticket.find({user:user.id})
    res.json({success:true,tickets}) 
  } catch (error) {
    res.json({success:false,error:"Internal error"})
  }

}
module.exports.tourBookings = async(req,res)=>{
  try {
    const user = req.user;
    const tickets = await tourTicket.find({user:user.id})
    if(tickets){
      res.json({success:true,tickets})
    }
    else{
      res.json({success:false,error:'network error'})
    }
  } catch (error) {
    console.log(error)
    res.json({success:false,error:"Internal error"})
  }
}

// Admin login. Admins are separate accounts (Admin collection), not travellers with a special email.
module.exports.verifyAdmin = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const admin = await Admin.findOne({ email });
    if (!admin || !(await bcrypt.compare(req.body.password || '', admin.password))) {
      return res.status(403).json({ success: false, error: "Invalid email or password" });
    }
    const authToken = JWT.sign({ admin: { id: admin.id } }, JWT_SECRET);
    res.json({ success: true, authToken, admin: { _id: admin._id, firstName: admin.firstName, lastName: admin.lastName, email: admin.email } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

module.exports.verifyAgent = async (req, res) => {
  const { password } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();
  try {
    const agent = await Agent.findOne({ email });
    if (!agent || !(await bcrypt.compare(password || '', agent.password))) {
      return res.status(403).json({ success: false, error: "Invalid email or password" });
    }
    // Correct credentials but not allowed in yet: tell the partner why.
    if (agent.blocked) {
      return res.status(403).json({ success: false, status: 'blocked', error: "This partner account has been blocked. Please contact support." });
    }
    if (agent.flag !== 1) {
      return res.status(403).json({ success: false, status: 'pending', error: "Your partner application is still under review." });
    }
    const authToken = JWT.sign({ agent: { id: agent.id } }, JWT_SECRET);
    res.json({ success: true, authToken, agent: { _id: agent._id, agentName: agent.agentName, email: agent.email }, agentId: agent._id });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
}

module.exports.createAgent = async (req, res) => {
  // Any early return below discards the uploaded document so no orphan files are left behind.
  const reject = (status, error) => {
    removeUpload(req.file);
    return res.status(status).json({ success: false, error });
  };
  try {
    const { agentName, password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!agentName || !email || !password) return reject(400, "Agency name, email and password are required");
    if (password.length < 6) return reject(400, "Password must be at least 6 characters");
    if (!req.file) return reject(400, "Please upload a verification document");
    if (await Agent.findOne({ email })) return reject(409, "An account with this email already exists");
    const secPass = await bcrypt.hash(password, 10);
    await Agent.create({ agentName, email, password: secPass, document: uploadedPath(req.file) });
    // No login token: partners can only log in after an admin approves the application.
    res.status(201).json({ success: true, message: "Application submitted. You can log in once it is approved." });
  } catch (error) {
    console.log(error);
    reject(500, "Internal server error");
  }
}