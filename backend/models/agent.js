const mongoose = require("mongoose");

const agentSchema = new mongoose.Schema(
    {
        agentName: {
            type: "string",
            required: true,
        },
        document:{
            type: "string",
            required: true,
        },
        password:{
            type: "string",
            required:true,
        },
        email:{
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        buses: [
            {
              type:mongoose.Schema.Types.ObjectId,
              ref:"Bus"
            }
        ],
        tours: [
            {
              type:mongoose.Schema.Types.ObjectId,
              ref:"Tour"
            }
        ],
        flag: {
            type: Number,
            default: 0,
          },
          blocked: {
            type: Boolean,
            default: false
        }
        

    },
    { timestamps: true }
);

const Agent = mongoose.model("Agent", agentSchema);

module.exports = Agent;