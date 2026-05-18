const Room = require("../models/Room");
const AppError = require("../utils/AppError");
const { validateObjectId } = require("../utils/validators");

const sessionOption = (session) => (session ? { session } : {});

const getNights = (checkIn, checkOut) => {
  const milliseconds = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
};

const toPositiveInteger = (value, fieldName, { allowZero = false } = {}) => {
  const number = Number(value);

  if (!Number.isInteger(number) || number < (allowZero ? 0 : 1)) {
    throw new AppError(
      `${fieldName} must be ${allowZero ? "a non-negative" : "a positive"} whole number`,
      400
    );
  }

  return number;
};

const normalizeRoomItemsPayload = (payload) => {
  const rawItems = Array.isArray(payload.roomItems) && payload.roomItems.length > 0
    ? payload.roomItems
    : [
        {
          roomType: payload.roomType,
          roomId: payload.roomId,
          roomCount: payload.roomCount || payload.numberOfRooms || 1,
          adultGuests: payload.adultGuests ?? payload.numberOfGuests,
          childGuests: payload.childGuests ?? payload.numberOfChildren ?? 0
        }
      ];

  return rawItems.map((item, index) => {
    const roomType = Room.normalizeRoomType(item.roomType);

    if (!roomType) {
      throw new AppError(`roomItems[${index}].roomType is required`, 400);
    }

    return {
      roomType,
      roomId: item.roomId || null,
      roomCount: toPositiveInteger(item.roomCount || 1, `roomItems[${index}].roomCount`),
      adultGuests: toPositiveInteger(
        item.adultGuests ?? item.numberOfGuests ?? 0,
        `roomItems[${index}].adultGuests`,
        { allowZero: true }
      ),
      childGuests: toPositiveInteger(
        item.childGuests ?? item.numberOfChildren ?? 0,
        `roomItems[${index}].childGuests`,
        { allowZero: true }
      )
    };
  });
};

const getRoomProfilesByType = async (roomTypes, { session } = {}) => {
  const rooms = await Room.find({
    status: "active",
    roomType: { $in: [...new Set(roomTypes)] }
  })
    .sort({ roomType: 1, roomNumber: 1 })
    .session(session || null);

  const profiles = new Map();

  rooms.forEach((room) => {
    const current = profiles.get(room.roomType) || {
      roomType: room.roomType,
      totalRooms: 0,
      basePrice: null,
      adultCapacityByRoom: [],
      childCapacityByRoom: []
    };

    current.totalRooms += 1;
    current.basePrice =
      current.basePrice === null
        ? room.basePrice || 0
        : Math.min(current.basePrice, room.basePrice || current.basePrice);
    current.adultCapacityByRoom.push(room.capacity || 0);
    current.childCapacityByRoom.push(room.childCapacity || 0);
    profiles.set(room.roomType, current);
  });

  return profiles;
};

const sumTopCapacities = (capacities, count) =>
  [...capacities]
    .sort((left, right) => right - left)
    .slice(0, count)
    .reduce((total, capacity) => total + capacity, 0);

const buildPricedRoomItems = async (rawItems, { nights, session } = {}) => {
  const profiles = await getRoomProfilesByType(
    rawItems.map((item) => item.roomType),
    { session }
  );
  const requestedCountByType = rawItems.reduce((totals, item) => {
    totals.set(item.roomType, (totals.get(item.roomType) || 0) + item.roomCount);
    return totals;
  }, new Map());

  requestedCountByType.forEach((requestedCount, roomType) => {
    const profile = profiles.get(roomType);

    if (!profile || profile.totalRooms === 0) {
      throw new AppError("No active room is configured for the selected room type", 400);
    }

    if (requestedCount > profile.totalRooms) {
      throw new AppError(
        `${roomType} only has ${profile.totalRooms} active room unit(s) configured`,
        400
      );
    }
  });

  const roomItems = rawItems.map((item) => {
    const profile = profiles.get(item.roomType);

    const adultCapacity = sumTopCapacities(profile.adultCapacityByRoom, item.roomCount);
    const childCapacity = sumTopCapacities(profile.childCapacityByRoom, item.roomCount);

    if (item.adultGuests > adultCapacity) {
      throw new AppError(
        `Selected ${item.roomType} room(s) can host up to ${adultCapacity} adult guests`,
        400
      );
    }

    if (item.childGuests > childCapacity) {
      throw new AppError(
        `Selected ${item.roomType} room(s) can host up to ${childCapacity} children`,
        400
      );
    }

    const basePrice = profile.basePrice || 0;

    return {
      roomType: item.roomType,
      roomCount: item.roomCount,
      adultGuests: item.adultGuests,
      childGuests: item.childGuests,
      basePrice,
      nights,
      subtotal: basePrice * item.roomCount * nights,
      assignedRooms: []
    };
  });

  const totalAdults = roomItems.reduce((total, item) => total + item.adultGuests, 0);

  if (totalAdults <= 0) {
    throw new AppError("Please enter at least one adult guest", 400);
  }

  return roomItems;
};

const getRoomItemsFromBooking = (booking) => {
  if (Array.isArray(booking.roomItems) && booking.roomItems.length > 0) {
    return booking.roomItems;
  }

  if (!booking.roomType) {
    return [];
  }

  return [
    {
      roomType: booking.roomType,
      roomCount: booking.roomId ? 1 : booking.numberOfRooms || 1,
      adultGuests: booking.numberOfGuests || 0,
      childGuests: booking.numberOfChildren || 0,
      basePrice: booking.totalAmount || 0,
      nights: getNights(booking.checkIn, booking.checkOut),
      subtotal: booking.totalAmount || 0,
      assignedRooms: booking.roomId
        ? [
            {
              roomId: booking.roomId?._id || booking.roomId,
              roomNumber: booking.roomId?.roomNumber || "",
              roomType: booking.roomId?.roomType || booking.roomType,
              name: booking.roomId?.name || "",
              basePrice: booking.roomId?.basePrice || 0
            }
          ]
        : []
    }
  ];
};

const toRoomIdValue = (roomId) => roomId?._id || roomId;

const toRoomIdString = (roomId) => {
  const value = toRoomIdValue(roomId);

  return value ? String(value) : "";
};

const getAssignedRoomsFromBooking = (booking) => {
  const assignedRooms = [];
  const seenRoomIds = new Set();

  const addAssignedRoom = (room) => {
    const roomData = typeof room?.toObject === "function" ? room.toObject() : room;
    const roomId = toRoomIdValue(roomData.roomId);
    const key = toRoomIdString(roomId);

    if (!key || seenRoomIds.has(key)) {
      return;
    }

    seenRoomIds.add(key);
    assignedRooms.push({
      ...roomData,
      roomId
    });
  };

  getRoomItemsFromBooking(booking).forEach((item) => {
    (item.assignedRooms || []).forEach((room) => {
      addAssignedRoom(room);
    });
  });

  if (booking.roomId) {
    addAssignedRoom({
      roomId: toRoomIdValue(booking.roomId),
      roomNumber: booking.roomId?.roomNumber || "",
      roomType: booking.roomId?.roomType || booking.roomType,
      name: booking.roomId?.name || "",
      basePrice: booking.roomId?.basePrice || 0
    });
  }

  return assignedRooms;
};

const buildRoomSnapshot = (room) => ({
  roomId: room._id,
  roomNumber: room.roomNumber,
  roomType: room.roomType,
  name: room.name || "",
  basePrice: room.basePrice || 0
});

const hydrateAssignedRoomSnapshots = async (roomIds, { session } = {}) => {
  roomIds.forEach((roomId) => {
    validateObjectId(roomId, "room id");
  });

  const rooms = await Room.find({ _id: { $in: roomIds }, status: "active" })
    .sort({ roomType: 1, roomNumber: 1 })
    .session(session || null);

  const roomsById = new Map(rooms.map((room) => [String(room._id), room]));

  roomIds.forEach((roomId) => {
    if (!roomsById.has(String(roomId))) {
      throw new AppError("Selected room is not active or does not exist", 404);
    }
  });

  return roomIds.map((roomId) => buildRoomSnapshot(roomsById.get(String(roomId))));
};

const saveBookingRoomAssignments = async (booking, assignedRoomItems, { session } = {}) => {
  const firstAssignedRoom = assignedRoomItems
    .flatMap((item) => item.assignedRooms || [])
    .find((room) => room.roomId);

  booking.roomItems = assignedRoomItems;
  booking.numberOfRooms = assignedRoomItems.reduce((total, item) => total + item.roomCount, 0);
  booking.numberOfGuests = assignedRoomItems.reduce((total, item) => total + item.adultGuests, 0);
  booking.numberOfChildren = assignedRoomItems.reduce((total, item) => total + item.childGuests, 0);
  booking.roomType = assignedRoomItems[0]?.roomType || booking.roomType;
  booking.roomId = firstAssignedRoom?.roomId || booking.roomId || null;

  await booking.save(sessionOption(session));

  return booking;
};

module.exports = {
  buildPricedRoomItems,
  buildRoomSnapshot,
  getAssignedRoomsFromBooking,
  getNights,
  getRoomItemsFromBooking,
  hydrateAssignedRoomSnapshots,
  normalizeRoomItemsPayload,
  saveBookingRoomAssignments
};
