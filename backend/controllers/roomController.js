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
const {
  getAvailabilityByRoomType,
  getAvailabilityCalendarByRoomType
} = require("../services/availabilityService");

const normalizeRoomPayload = (body) => {
  const roomType = Room.normalizeRoomType(body.roomType);
  const status = body.status || (body.isActive === false ? "inactive" : "active");

  if (!roomType) {
    throw new AppError("roomType is required", 400);
  }

  validateEnum(status, Room.roomStatuses, "status");

  return {
    roomNumber: String(body.roomNumber || body.code || "").trim(),
    roomType,
    name: body.name,
    capacity: validatePositiveNumber(body.capacity ?? body.maxGuestsPerUnit, "capacity"),
    childCapacity: validatePositiveNumber(body.childCapacity ?? 0, "childCapacity", true),
    basePrice: validatePositiveNumber(body.basePrice || 0, "basePrice", true),
    status
  };
};

const listRooms = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.roomType && req.query.roomType !== "all") {
    query.roomType = Room.normalizeRoomType(req.query.roomType);
  }

  if (req.query.status) {
    validateEnum(req.query.status, Room.roomStatuses, "status");
    query.status = req.query.status;
  }

  const rooms = await Room.find(query).sort({ roomType: 1, roomNumber: 1 });

  sendResponse(res, 200, "Rooms retrieved successfully", rooms);
});

const listRoomTypes = asyncHandler(async (req, res) => {
  const rooms = await Room.find({ status: "active" }).sort({ roomType: 1, roomNumber: 1 });
  const typeMap = new Map();

  rooms.forEach((room) => {
    const current = typeMap.get(room.roomType);

    if (!current) {
      typeMap.set(room.roomType, {
        roomType: room.roomType,
        label: room.name,
        adultCapacity: room.capacity,
        childCapacity: room.childCapacity || 0,
        basePrice: room.basePrice,
        availableUnits: 1
      });
      return;
    }

    current.adultCapacity = Math.max(current.adultCapacity, room.capacity || 0);
    current.childCapacity = Math.max(current.childCapacity, room.childCapacity || 0);
    current.basePrice = Math.min(current.basePrice, room.basePrice || current.basePrice);
    current.availableUnits += 1;
  });

  sendResponse(res, 200, "Room types retrieved successfully", Array.from(typeMap.values()));
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
    const roomType = Room.normalizeRoomType(req.body.roomType);

    if (!roomType) {
      throw new AppError("roomType is required", 400);
    }

    updates.roomType = roomType;
  }

  if (req.body.name !== undefined) {
    updates.name = req.body.name;
  }

  if (req.body.capacity !== undefined || req.body.maxGuestsPerUnit !== undefined) {
    updates.capacity = validatePositiveNumber(
      req.body.capacity ?? req.body.maxGuestsPerUnit,
      "capacity"
    );
  }

  if (req.body.childCapacity !== undefined) {
    updates.childCapacity = validatePositiveNumber(
      req.body.childCapacity,
      "childCapacity",
      true
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

  const availability = await getAvailabilityByRoomType({
    roomType: Room.normalizeRoomType(req.query.roomType),
    checkIn: req.query.checkIn,
    checkOut: req.query.checkOut
  });

  sendResponse(res, 200, "Room availability retrieved successfully", availability);
});

const getRoomAvailabilityCalendar = asyncHandler(async (req, res) => {
  requireFields(req.query, ["roomType", "startDate", "endDate"]);

  const calendar = await getAvailabilityCalendarByRoomType({
    roomType: req.query.roomType,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  });

  sendResponse(res, 200, "Room availability calendar retrieved successfully", calendar);
});

module.exports = {
  listRooms,
  listRoomTypes,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomAvailability,
  getRoomAvailabilityCalendar
};
