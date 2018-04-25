![Moleculer logo](http://moleculer.services/images/banner.png)

# moleculer-socketio [![NPM version](https://img.shields.io/npm/v/moleculer-bee-queue.svg)](https://www.npmjs.com/package/moleculer-socketio)


#   Description

Simple socketio addon for moleculer

# Install

```bash
$ npm install moleculer-socketio --save
```

# Note
I've not finished it yet but it worked.
See the usage, i'll make a small documentation in few days!

# Usage

This is on moleculer side

```javascript

const SocketIO = require("moleculer-socketio");


module.exports = {
	name: "socket-io",

	mixins: [ SocketIO ],

	settings: {
		port: 5000,
	},


	actions: {

		// call "socket-io.boardcast" --message hello
		boardcast: {
			params: {
				message: "string"
			},
			handler(ctx) {
				this.io.emit("all", ctx.params.message);
				return ctx.params.message;
			}
		},


		// call "socket-io.count"
		count: {
			handler(ctx) {
				return this.io.engine.clientsCount;
			}
		}

	},

	methods: {

		onCreated(io) {
			console.log("socket-io.service - onCreated");
			this.io = io;
			this.io.on("connection", this.onConnection);
			console.log("onCreated -- ");
		},

		onConnection(socket) {
			console.log("server - sucess on connection");

			var clients = socket.client.conn.emit.length;
 			console.log("clients: " + clients);

			socket.on('subscribeToTimer', (interval) => {
				console.log('client is subscribing to timer with interval ', interval);
				setInterval(() => {
					socket.emit('timer', new Date());
				}, interval);
			});

			socket.on("hello", (data) => {
				console.log("server - received hello", data);
			});

			socket.on('disconnect', () => {
				console.log('server - user disconnected');
			});
		},

	},

}



```


This should be on client side

```javascript

import io from 'socket.io-client';


this.socket = io("http://localhost:5000");

this.socket.on("all", (data) => {
  console.log("client -- ", data);
});

this.socket.on('timer', timestamp => console.log("TIMER IS", timestamp));
this.socket.emit('subscribeToTimer', 1000);

```
