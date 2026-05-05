const Room = require("../models/Room");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  requireFields,
  validateEnum,
  validateObjectId,
  validatePositiveNumber
} = require("../utils/validators");
const { getAvailabilityByRoomType } = require("../services/availabilityService");

const normalizeRoomPayload = (body) => {
  const roomType = body.roomType;
  const status = body.status || (body.isActive === false ? "inactive" : "active");

  validateEnum(roomType, Room.roomTypes, "roomType");
  validateEnum(status, Room.roomStatuses, "status");

  return {
    roomNumber: String(body.roomNumber || body.code || "").trim(),
    roomType,
    name: body.name,
    capacity: validatePositiveNumber(body.capacity || body.maxGuestsPerUnit, "capacity"),
    basePrice: validatePositiveNumber(body.basePrice || 0, "basePrice", true),
    status
  };
};

const listRooms = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.roomType && req.query.roomType !== "all") {
    validateEnum(req.query.roomType, Room.roomTypes, "roomType");
    query.roomType = req.query.roomType;
  }

  if (req.query.status) {
    validateEnum(req.query.status, Room.roomStatuses, "status");
    query.status = req.query.status;
  }

  const rooms = await Room.find(query).sort({ roomType: 1, roomNumber: 1 });

  sendResponse(res, 200, "Rooms retrieved successfully", rooms);
});

const getRoom = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "room id");

  const room = await Room.findById(req.params.id);

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  sendResponse(res, 200, "Room retrieved successfully", room);
});

const createRoom = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name", "roomType"]);
  const payload = normalizeRoomPayload(req.body);

  if (!payload.roomNumber) {
    throw new AppError("roomNumber is required", 400);
  }

  const room = await Room.create(payload);

  sendResponse(res, 201, "Room created successfully", room);
});

const updateRoom = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "room id");

  const updates = {};

  if (req.body.roomNumber !== undefined || req.body.code !== undefined) {
    updates.roomNumber = String(req.body.roomNumber || req.body.code).trim();
  }

  if (req.body.roomType !== undefined) {
    validateEnum(req.body.roomType, Room.roomTypes, "roomType");
    updates.roomType = req.body.roomType;
  }

  if (req.body.name !== undefined) {
    updates.name = req.body.name;
  }

  if (req.body.capacity !== undefined || req.body.maxGuestsPerUnit !== undefined) {
    updates.capacity = validatePositiveNumber(
      req.body.capacity || req.body.maxGuestsPerUnit,
      "capacity"
    );
  }

  if (req.body.basePrice !== undefined) {
    updates.basePrice = validatePositiveNumber(req.body.basePrice, "basePrice", true);
  }

  if (req.body.status !== undefined || req.body.isActive !== undefined) {
    const status = req.body.status || (req.body.isActive === false ? "inactive" : "active");
    validateEnum(status, Room.roomStatuses, "status");
    updates.status = status;
  }

  const room = await Room.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  sendResponse(res, 200, "Room updated successfully", room);
});

const deleteRoom = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "room id");

  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { status: "inactive" },
    { new: true }
  );

  if (!room) {
    throw new AppError("Room not found", 404);
  }

  sendResponse(res, 200, "Room marked inactive successfully", room);
});

const getRoomAvailability = asyncHandler(async (req, res) => {
  requireFields(req.query, ["roomType", "checkIn", "checkOut"]);
  validateEnum(req.query.roomType, Room.roomTypes, "roomType");

  const availability = await getAvailabilityByRoomType({
    roomType: req.query.roomType,
    checkIn: req.query.checkIn,
    checkOut: req.query.checkOut
  });

  sendResponse(res, 200, "Room availability retrieved successfully", availability);
});

module.exports = {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability
};
