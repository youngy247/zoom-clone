const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const { v4: uuidV4 } = require('uuid');
const connection = require('./db');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');



let isAvailable = true;
let adminSocketId = null;
let roomOccupied = false;

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Add the body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/login', (req, res) => {
    res.render('login');
  });
  
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    // Fetch the preset username and hashed password from the database
    const query = 'SELECT * FROM admin WHERE username = ?';
    connection.query(query, [username], (err, results) => {
      if (err) {
        console.error('Error querying the database:', err);
        return res.status(500).send('Internal Server Error');
      }
  
      if (results.length === 0) {
        return res.status(401).send('Invalid username or password');
      }
  
      const admin = results[0];
  
      // Compare the provided password with the hashed password from the database
      bcrypt.compare(password, admin.password, (compareErr, match) => {
        if (compareErr) {
          console.error('Error comparing passwords:', compareErr);
          return res.status(500).send('Internal Server Error');
        }
  
        if (!match) {
          return res.status(401).send('Invalid username or password');
        }
  
        // Authentication successful
        // Set a session or generate a JWT token here for further authentication/authorization
        res.send('Login successful');
      });
    });
  });

app.get('/', (req, res) => {
  res.render('home', { isAvailable });
});

app.get('/:room', (req, res) => {
    const { room } = req.params;
    const { isAdmin } = req.query; // Assuming you have a query parameter indicating the user's role
  
    res.render('room', { roomId: room, isAvailable, isAdmin: Boolean(isAdmin) });
  });
  

io.on('connection', (socket) => {
  if (!adminSocketId) {
    adminSocketId = socket.id;
    isAvailable = true;
    socket.emit('availability-updated', isAvailable); // Notify admin about initial availability status
  }

  socket.on('join-room', (roomId, userId) => {
    if (roomOccupied || !isAvailable) {
      socket.emit('room-unavailable');
      return;
    }

    socket.join(roomId);
    socket.broadcast.to(roomId).emit('user-connected', userId);

    socket.on('disconnect', () => {
      socket.broadcast.to(roomId).emit('user-disconnected', userId);
    });
  });

  socket.on('availability-change', (availability) => {
    if (socket.id === adminSocketId) {
      isAvailable = availability;
      io.emit('availability-updated', isAvailable); // Notify all clients about the availability status change
    }
  });

  socket.on('accept-call', () => {
    if (socket.id === adminSocketId && !roomOccupied && isAvailable) {
      roomOccupied = true;
      socket.emit('call-accepted');
    }
  });

  socket.on('end-call', () => {
    if (roomOccupied) {
      const roomId = Object.keys(socket.rooms)[1]; // Get the room ID
      socket.broadcast.to(roomId).emit('user-disconnected', socket.id);
      roomOccupied = false;
    }
  });
});

server.listen(3000, () => {
  console.log('Server started on port 3000');
});
