const validator = require('validator');
const users = [];

const addUser = ({ id, username, room }) => {
  // clean the data
  if (typeof username !== 'string' || typeof room !== 'string') {
    return { error: 'Username and room must be strings!' };
  }
  username = validator.escape(username.trim().toLowerCase());
  room = validator.escape(room.trim().toLowerCase());

  // Validate the data
  if (!username || !room) {
    return {
      error: "Username and room are required!",
    };
  }
  if (!validator.isLength(username, { min: 2, max: 20 })) {
    return { error: 'Username must be 2-20 characters.' };
  }
  if (!validator.isLength(room, { min: 2, max: 20 })) {
    return { error: 'Room name must be 2-20 characters.' };
  }
  if (!validator.isAlphanumeric(username, 'en-US', { ignore: ' _-' })) {
    return { error: 'Username contains invalid characters.' };
  }
  if (!validator.isAlphanumeric(room, 'en-US', { ignore: ' _-' })) {
    return { error: 'Room name contains invalid characters.' };
  }

  // Check for existing user
  const existingUser = users.find((user) => {
    return user.room === room && user.username === username;
  });

  if (existingUser) {
    return {
      error: "Username already exists!",
    };
  }
  // Store user

  const user = { id, username, room };
  users.push(user);
  return { user };
};

const removeUser = (id) => {
  const index = users.findIndex((user) => user.id === id);
  if (index !== -1) {
    return users.splice(index, 1)[0];
  }
};
// Get User
const getUser = (id) => {
  return users.find((user) => user.id === id);
};

const getUsersInRoom = (room) => {
  return users.filter((user) => user.room === room);
};
module.exports = {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
};
