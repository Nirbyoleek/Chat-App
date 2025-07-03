const path = require("path");
const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const app = express();
const Filter = require("bad-words");
const {
  generateMessage,
  generateLocationMessage,
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/users");
const server = http.createServer(app);
const validator = require('validator');

const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

const onlineUsers = new Set();
const activeRooms = new Set();

io.on("connection", (socket) => {
  console.log("New Websocket connection");

  socket.on("join", ({ username, room }, callback) => {
    try {
      const { error, user } = addUser({ id: socket.id, username, room });
      if (error) {
        return callback(error);
      }
      onlineUsers.add(user.username);
      activeRooms.add(user.room);
      io.emit('onlineUsers', Array.from(onlineUsers));
      socket.join(user.room);
      socket.emit("message", generateMessage("Admin", "Welcome!"));
      socket.broadcast
        .to(user.room)
        .emit("message", generateMessage("Admin", `${user.username} has joined`));
      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
      callback();
    } catch (err) {
      callback("An error occurred while joining the room.");
    }
  });

  socket.on("sendMessage", (message, callback) => {
    try {
      const filter = new Filter();
      const user = getUser(socket.id);
      if (!user) {
        return callback("User not found.");
      }
      if (typeof message !== 'string' || !validator.isLength(message, { min: 1, max: 200 })) {
        return callback("Message must be 1-200 characters.");
      }
      const cleanMessage = validator.escape(message);
      if (filter.isProfane(cleanMessage)) {
        return callback("Profanity is not allowed");
      }
      io.to(user.room).emit("message", generateMessage(user.username, cleanMessage));
      callback();
    } catch (err) {
      callback("An error occurred while sending the message.");
    }
  });

  socket.on("sendLocation", (coords, callback) => {
    try {
      const user = getUser(socket.id);
      if (!user) {
        return callback("User not found.");
      }
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        return callback("Invalid location data.");
      }
      io.to(user.room).emit(
        "locationMessage",
        generateLocationMessage(
          user.username,
          `https://google.com/maps?q=${coords.latitude},${coords.longitude}`
        )
      );
      callback();
    } catch (err) {
      callback("An error occurred while sharing location.");
    }
  });

  socket.on("typing", ({ room }) => {
    const user = getUser(socket.id);
    if (user && room) {
      socket.broadcast.to(room).emit("showTyping", { username: user.username });
    }
  });

  socket.on("stopTyping", ({ room }) => {
    if (room) {
      socket.broadcast.to(room).emit("hideTyping");
    }
  });

  socket.on("disconnect", () => {
    try {
      const user = removeUser(socket.id);
      if (user) {
        onlineUsers.delete(user.username);
        if (getUsersInRoom(user.room).length === 0) {
          activeRooms.delete(user.room);
        }
        io.emit('onlineUsers', Array.from(onlineUsers));
        io.to(user.room).emit(
          "message",
          generateMessage("Admin", `${user.username} has disconnected`)
        );
        io.to(user.room).emit("roomData", {
          room: user.room,
          users: getUsersInRoom(user.room),
        });
      }
    } catch (err) {
      // Optionally log error
    }
  });

  socket.on('requestOnlineUsers', () => {
    socket.emit('onlineUsers', Array.from(onlineUsers));
  });

  socket.on('sendFile', (file, callback) => {
    try {
      const user = getUser(socket.id);
      if (!user) return callback('User not found');
      if (!file || !file.data || !file.name || !file.type) return callback('Invalid file');
      io.to(user.room).emit('fileMessage', {
        url: file.data,
        name: file.name,
        type: file.type,
        username: user.username,
        createdAt: new Date().getTime(),
        message: file.message || '',
      });
      callback();
    } catch (err) {
      callback('Error sending file');
    }
  });
});

app.get('/rooms', (req, res) => {
  res.json(Array.from(activeRooms));
});

server.listen(port, () => {
  console.log(`The server is running on port : ${port}`);
});
