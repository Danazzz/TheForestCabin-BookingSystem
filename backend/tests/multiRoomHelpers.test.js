const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getAssignedRoomsFromBooking,
  getNights,
  normalizeRoomItemsPayload
} = require("../services/bookingRoomItemsService");
const { getSuccessfulOverlapQuery } = require("../services/availabilityService");

test("normalizeRoomItemsPayload keeps mixed multi-room booking rows", () => {
  const items = normalizeRoomItemsPayload({
    roomItems: [
      {
        roomType: "Deluxe Cabin",
        roomCount: 2,
        adultGuests: 4,
        childGuests: 1
      },
      {
        roomType: "suite",
        roomCount: 1,
        adultGuests: 2,
        childGuests: 0
      }
    ]
  });

  assert.deepEqual(items, [
    {
      roomType: "deluxe_cabin",
      roomId: null,
      roomCount: 2,
      adultGuests: 4,
      childGuests: 1
    },
    {
      roomType: "suite",
      roomId: null,
      roomCount: 1,
      adultGuests: 2,
      childGuests: 0
    }
  ]);
});

test("getAssignedRoomsFromBooking deduplicates multi-room and legacy room snapshots", () => {
  const sharedRoomId = "665f0d32f07f1d0f20f00001";
  const secondRoomId = "665f0d32f07f1d0f20f00002";
  const booking = {
    roomId: {
      _id: sharedRoomId,
      roomNumber: "101",
      roomType: "deluxe",
      name: "Deluxe 101",
      basePrice: 450000
    },
    roomType: "deluxe",
    roomItems: [
      {
        roomType: "deluxe",
        assignedRooms: [
          {
            roomId: sharedRoomId,
            roomNumber: "101",
            roomType: "deluxe",
            toObject() {
              return {
                roomId: sharedRoomId,
                roomNumber: "101",
                roomType: "deluxe"
              };
            }
          },
          {
            roomId: secondRoomId,
            roomNumber: "102",
            roomType: "deluxe"
          }
        ]
      }
    ]
  };

  const assignedRooms = getAssignedRoomsFromBooking(booking);

  assert.equal(assignedRooms.length, 2);
  assert.deepEqual(
    assignedRooms.map((room) => String(room.roomId)),
    [sharedRoomId, secondRoomId]
  );
});

test("getSuccessfulOverlapQuery excludes current booking during edit checks", () => {
  const query = getSuccessfulOverlapQuery({
    roomId: "665f0d32f07f1d0f20f00001",
    checkIn: new Date("2026-05-01T00:00:00.000Z"),
    checkOut: new Date("2026-05-03T00:00:00.000Z"),
    excludeBookingId: "665f0d32f07f1d0f20f00009"
  });

  assert.equal(query.bookingStatus, "success");
  assert.deepEqual(query._id, { $ne: "665f0d32f07f1d0f20f00009" });
  assert.deepEqual(query.checkIn, { $lt: new Date("2026-05-03T00:00:00.000Z") });
  assert.deepEqual(query.checkOut, { $gt: new Date("2026-05-01T00:00:00.000Z") });
  assert.deepEqual(query.$or, [
    { roomId: "665f0d32f07f1d0f20f00001" },
    { "roomItems.assignedRooms.roomId": "665f0d32f07f1d0f20f00001" }
  ]);
});

test("getNights counts checkout as exclusive", () => {
  assert.equal(getNights("2026-05-01", "2026-05-04"), 3);
});
