const express = require("express");
const {
  getAllCredentials,
  getCredentialById,
  createCredential,
  updateCredential,
  toggleCredentialStatus,
  deleteCredential,
  getActiveCredentialByType,
  validateCredential,
} = require("../controllers/credentials.controller");
const { authenticateToken } = require("../middlewares/auth.middleware");
const { isAdmin } = require("../middlewares/role.middleware");

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken, isAdmin);

// Get all credentials
router.get("/", getAllCredentials);

// Get credential by ID
router.get("/:id", getCredentialById);

// Create new credential
router.post("/", createCredential);

// Update credential
router.put("/:id", updateCredential);

// Toggle credential active status
router.patch("/:id/toggle-status", toggleCredentialStatus);

// Delete credential
router.delete("/:id", deleteCredential);

// Validate credential (test connection)
router.post("/:id/validate", validateCredential);

// Get active credential by type (for internal use)
router.get("/type/:type", getActiveCredentialByType);

module.exports = router;
