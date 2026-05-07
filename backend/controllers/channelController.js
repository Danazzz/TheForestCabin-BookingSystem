const Channel = require("../models/Channel");
const asyncHandler = require("../utils/asyncHandler");
const sendResponse = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const { requireFields, validateObjectId } = require("../utils/validators");

const normalizePayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  if (!partial || body.name !== undefined) {
    const name = String(body.name || "").trim();

    if (!name) {
      throw new AppError("name is required", 400);
    }

    payload.name = name;
  }

  if (body.key !== undefined) {
    payload.key = Channel.normalizeChannelKey(body.key);
  } else if (!partial && body.name !== undefined) {
    payload.key = Channel.normalizeChannelKey(body.name);
  }

  if (payload.key === "") {
    throw new AppError("key must contain at least one letter or number", 400);
  }

  if (body.type !== undefined) {
    payload.type = String(body.type || "other").trim() || "other";
  } else if (!partial) {
    payload.type = "other";
  }

  if (body.isActive !== undefined) {
    payload.isActive = Boolean(body.isActive);
  } else if (!partial) {
    payload.isActive = true;
  }

  return payload;
};

const listChannels = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.includeInactive !== "true") {
    query.isActive = true;
  }

  const channels = await Channel.find(query).sort({ name: 1 });

  sendResponse(res, 200, "Channels retrieved successfully", channels);
});

const createChannel = asyncHandler(async (req, res) => {
  requireFields(req.body, ["name"]);
  const channel = await Channel.create(normalizePayload(req.body));

  sendResponse(res, 201, "Channel created successfully", channel);
});

const updateChannel = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "channel id");

  const channel = await Channel.findByIdAndUpdate(
    req.params.id,
    normalizePayload(req.body, { partial: true }),
    { new: true, runValidators: true }
  );

  if (!channel) {
    throw new AppError("Channel not found", 404);
  }

  sendResponse(res, 200, "Channel updated successfully", channel);
});

const deleteChannel = asyncHandler(async (req, res) => {
  validateObjectId(req.params.id, "channel id");

  const channel = await Channel.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!channel) {
    throw new AppError("Channel not found", 404);
  }

  sendResponse(res, 200, "Channel disabled successfully", channel);
});

module.exports = {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel
};
