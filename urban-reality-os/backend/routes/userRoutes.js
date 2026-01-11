import express from "express";
import User from "../models/User.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error('profile error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post("/location", auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      location: { lat, lng }
    });
    res.json({ message: "Location saved" });
  } catch (err) {
    console.error('location save error', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
