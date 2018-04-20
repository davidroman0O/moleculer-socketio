/*
 * moleculer-socketio
 */

 "use strict";

const express = require("express");

/**
*  Mixin service for socketio
* @name moleculer-socketio
* @module Service
*/
module.exports = {
	name: "socketio",

	/**
	 * Methods
	 */
	methods: {

	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		var app = express();

		this.http = require('http').Server(app);
		this.io = require('socket.io')(this.http);

		this.schema.methods.onCreated(this.io);

		this.http.listen(
			this.schema.settings.port,
			() => {
				console.log(`listening on *:${this.schema.settings.port}`);
			}
		);
	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};
