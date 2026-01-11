import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  location: {
    lat: Number,
    lng: Number
  },
  savedLocations: [
    {
      name: String,
      lat: Number,
      lng: Number,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
