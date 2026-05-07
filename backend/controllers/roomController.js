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
    description: String(body.description || "").trim(),
    imageUrl: String(body.imageUrl || "").trim(),
    altText: String(body.altText || "").trim(),
    details: parseRoomDetails(body.details),
    status
  };
};

const parseRoomDetails = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const getRoomTypeLabel = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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
        label: room.name || getRoomTypeLabel(room.roomType),
        adultCapacity: room.capacity,
        childCapacity: room.childCapacity || 0,
        basePrice: room.basePrice,
        description: room.description || "",
        imageUrl: room.imageUrl || "",
        altText: room.altText || "",
        details: room.details || [],
        firstRoomNumber: room.roomNumber,
        availableUnits: 1
      });
      return;
    }

    current.adultCapacity = Math.max(current.adultCapacity, room.capacity || 0);
    current.childCapacity = Math.max(current.childCapacity, room.childCapacity || 0);
    current.basePrice = Math.min(current.basePrice, room.basePrice || current.basePrice);
    current.description = current.description || room.description || "";
    current.imageUrl = current.imageUrl || room.imageUrl || "";
    current.altText = current.altText || room.altText || "";
    current.details = current.details.length > 0 ? current.details : room.details || [];
    current.firstRoomNumber = [current.firstRoomNumber, room.roomNumber].sort((left, right) =>
      String(left || "").localeCompare(String(right || ""), undefined, { numeric: true })
    )[0];
    current.availableUnits += 1;
  });

  const roomTypes = Array.from(typeMap.values()).sort((left, right) => (
    String(left.firstRoomNumber || "").localeCompare(String(right.firstRoomNumber || ""), undefined, { numeric: true }) ||
    left.roomType.localeCompare(right.roomType)
  ));

  roomTypes.forEach((roomType) => {
    delete roomType.firstRoomNumber;
  });

  sendResponse(res, 200, "Room types retrieved successfully", roomTypes);
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

  if (req.body.description !== undefined) {
    updates.description = String(req.body.description || "").trim();
  }

  if (req.body.imageUrl !== undefined) {
    updates.imageUrl = String(req.body.imageUrl || "").trim();
  }

  if (req.body.altText !== undefined) {
    updates.altText = String(req.body.altText || "").trim();
  }

  if (req.body.details !== undefined) {
    updates.details = parseRoomDetails(req.body.details);
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
