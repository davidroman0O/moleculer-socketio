/*
 * moleculer-socketio
 */

 "use strict";

const express = require("express");
const Promise = require("bluebird");
const mapKeys = require("lodash/mapKeys");
const { ValidationError } = require("moleculer").Errors;


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

		getListActionFromWhitelistPattern(event) {
			const svc = this;
			svc.logger.info("Check action list for", event);
			let map_action_names = undefined;
			let service_action_name = "";
			let result_regex = undefined;
			let list_actions = [];
			//
			svc.broker.services.map((service) => {
				map_action_names = Object.keys(service.actions);
				map_action_names.map((action) => {
					service_action_name = `${service.name}.${action}`;
					result_regex = service_action_name.match(event);
					if (result_regex) {
						//	it's a regex we can subcrive to this name
						if (result_regex.index == 0) {
							//	match on the correct name not a false positive
							list_actions.push(service_action_name);
						}
					} else {
						//	null case, it's not a regex bro
						if (service_action_name == event) {
							list_actions.push(service_action_name);
						}
					}
				});
			});
			//
			svc.logger.info("Event", event, " | match actions : ", list_actions);
			//
			return list_actions;
		},


		createMiddleware(middleware) {
			return async (ctx) => {
				// console.log("Enter in createMiddleware", ctx.params, middleware);
				const error = await middleware.call(this, ctx);
				// console.log(error);
				if (error) {
					throw Promise.reject(error);
				}
			}
		},

		createValidation(e) {
			const event = e;
			const { validator } = this.broker.validator;
			return (ctx) => {
				const check = validator.compile(event.value.params);
				// console.log("Validation of ", ctx.params, check);
				// console.log("Gonna valid", ctx.params);
				const res = check(ctx.params);
				// console.log("Result", res);
				if (res === true)
					return Promise.resolve();
				else
					return Promise.reject(new ValidationError("Parameters validation error!", null, res));

			}
		},

		createAction(e) {
			const event = e;
			return async (ctx) => {
				console.log("call broker action -- ", event);
				const payload = await this.broker.call(event, ctx.params);
				return payload;
			}
		},

		//	Small hackish way to work with arrow function to rebind them
		createWrappedFunction(fn) {

			return fn;

			// // console.log("createWrappedFunction", fn);
			// let code = fn.toString();
			// //	I know, it's a bit dirty but it works on maaaany cases
			// //	I just want to same developer experience as Moleculer
			// const extract = code.slice(code.indexOf("{") + 1, code.lastIndexOf("}"));
			// //
			// const asynchronous = code.indexOf("async") > -1;
			// var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor
			// //
			// if (asynchronous) {
			// 	return AsyncFunction("ctx", extract).bind(this);
			// }
			// return Function("ctx", extract);
		},

		//	Universal Promise Based Socket Callback
		createCallbackSocket(namespace, e, emit = true) {


			const svc = this;
			const event = Object.assign({}, e);

			// console.log(`createCallbackSocket - ${namespace} - `, event);

			//	Array of promises we need to manage real operations
			event.sequence = [];
			//	Array of generate promises for the params field
			event.validations = [];
			//	NOTE: a middleware is just a wrapped handler with true/false validation
			event.hasMiddlewares = false;

			if (event.value.hasOwnProperty("middlewares")) {
				this.hash_middlewares[`${namespace}.${event.name}`] = event.value.middlewares;
				event.hasMiddlewares = true;
			}

			event.actions = [];

			/*
				Now we re-create an new function that handle the specific action for each type of event
			*/
			// console.log(`Event ${event.name} should be a ${typeof event.value}`);
			switch (typeof event.value) {
				case "function":
					event.actions.push(event.name);
					// console.log(`Event ${event.name} is a function`);
					event.sequence.push(
						Promise.method(this.createWrappedFunction(event.value))
					);
					break;
				case "object":
					if (Array.isArray(event.value)) {
						// console.log(`Event ${event.name} is an Array`);
						event.value.map((item) => {
							switch (typeof item) {
								case "function":
									event.sequence.push(
										Promise.method( this.createWrappedFunction( this.createMiddleware(item) ) )
									);
									break;
								case "string":
									event.sequence.push(
										Promise.method( this.createWrappedFunction( this.createAction(item) ) )
									);
									event.actions.push(item);
									break;
							}
						})
						//	Push every items as promise in sequence
					} else {
						event.actions.push(event.name);
						// console.log(`Event ${event.name} is an object`);
						if (event.hasMiddlewares) {
							let middlewares = this.hash_middlewares[`${namespace}.${event.name}`];
							middlewares.map((middleware) => {
								event.sequence.push(
									Promise.method( this.createWrappedFunction( this.createMiddleware(middleware)) )
								);
							});
						}
						if (event.value.params) {
							event.validations.push(
								Promise.method( this.createValidation(event) )
							);
						}
						if (event.value.handler) {
							event.sequence.push(
								Promise.method( this.createWrappedFunction( event.value.handler) )
							);
						} else {
							throw new Error("Object event should have an handler");
						}
					}
					break;
				case "string":
					event.actions.push(event.name);
					event.sequence.push(
						Promise.method( this.createWrappedFunction( this.createAction(event.value) ) )
					);
					// console.log(`Event ${event.name} is a string`);
					break;
			}


			const proxy = function(socket, data) {

				/*
					this == Service
					socket == client
					data == data
				*/

				const broker = svc.broker;

				const newContext = Object.assign(svc.broker, {
					params: data,
					socket: socket,
					event: event
				});

				// console.log(`Receive ${namespace} event ${event.name}`, data);

				Promise.all(
					event.validations.map((i) => i.bind(this)(newContext))
					// event.validations.map((i) => i(this, newContext))
				)
				.then(
					() => Promise.all(
						event.sequence.map((i) => i.bind(this)(newContext))
						// event.sequence.map((i) => i.call(this, newContext))
					)
				)
				.then((obj) => {
					console.log("result", obj);
					const payload = obj.filter((o) => o != undefined || o != null);
					if (!emit) {
						return;
					}
					socket.emit(event.name, this.response(event, false, payload));
				})
				.catch((e) => {
					console.error(e)
					if (!emit) {
						return;
					}
					socket.emit(event.name, this.response(event, e, undefined)); // { error: true, message: e.toString() });
				});

			}

			return proxy.bind(this);
		},


		async createNamespace(io, key, values) {
			this.logger.info(`### ${key} is creating`);
			const svc = this;
			const socket_namespace = io.of(key);
			let event_connection = { name: "connection", value: (ctx) => { console.log("default connection"); return true; } };
			let event_disconnect = { name: "disconnect", value: (ctx) => { console.log("default disconnect"); return true; } };
			let events = [];
			let middlewares = [];
			let whitelist = [];
			//	Parse all namespaces schema and pre-fetch values
			mapKeys(values, (eventValue, eventKey) => {
				switch(eventKey) {
					case "connection":
						event_connection = { name: "connection", value: eventValue };
						break;
					case "disconnect":
						event_disconnect = { name: "disconnect", value: eventValue };
						break;
					case "middlewares":
						middlewares.push(...eventValue);
						break;
					case "whitelist":
						whitelist = eventValue;
						break;
					default:
						events.push({ name: eventKey, value: eventValue });
						break;
				}
			});
			//	Keep middlewares at namespace level
			this.hash_middlewares[`${key}`] = middlewares;
			//
			whitelist.map((pattern) => {
				let listActions = this.getListActionFromWhitelistPattern(pattern);
				listActions.map((event) => {
					events.push({ name: event, value: event });
				});
			});
			//
			events.map((event) => {
				this.hash_events[`${key}.${event.name}`] = this.createCallbackSocket(key, event);
			});
			//
			this.hash_events[`${key}.${event_connection.name}`] = this.createCallbackSocket(key, event_connection);
			this.hash_events[`${key}.${event_disconnect.name}`] = this.createCallbackSocket(key, event_disconnect, false);
			//
			//
			socket_namespace.on("connection", (client_socket) => {
				this.logger.info(`### ${key} - event - connection`);

				this.hash_events[`${key}.${event_connection.name}`](client_socket);
				client_socket.on("disconnect", this.hash_events[`${key}.${event_disconnect.name}`]);

				events.map((event) => {
					// this.logger.info(`${key} - ${event.name} - subscribed`, this.hash_events[`${key}.${event.name}`]);
					client_socket.on(event.name, this.hash_events[`${key}.${event.name}`].bind(this, client_socket));
				});

			});
			//
			this.logger.info(`### ${key} is created`);
		},

		async createService(io) {

			this.logger.info(`### Start create socket-io service ${this.schema.name}`);

			if (!this.schema.namespaces) {
				return new Error("There is no 'namespaces'");
			}

			const array_promise_namespaces = [];

			let mapNamespaces = (namespaceValues, namespaceKey) => {
				this.logger.info(`### Namespace ${namespaceKey} start creation`);
				array_promise_namespaces.push(
					this.createNamespace.bind(this, io, namespaceKey, namespaceValues).call()
				);
			};

			mapKeys(this.schema.namespaces, mapNamespaces);

			return Promise.all(array_promise_namespaces);
		}

	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {
		this.app = express();

		this.server = require('http').createServer(this.app);
		this.io = require('socket.io')(this.server, this.settings.options || {});

		/*
			key:
				namespace
			or
				namespace.event
		*/
		this.hash_middlewares = {};

		/*
			key: namespace.event
			value: function
		*/
		this.hash_events = {};

		this.hash_whitelist = {};

		this.response = (event, error, results) => {
			if (!error) {
				if (results.length == 1) {
					return { error: false, payload: results[0] };
				} else {
					return { error: false, payload: results };
				}
			}
			return { error: false, message: error.toString() };
		};

		if (this.schema.settings.response) {
			this.response = this.schema.settings.response;
		}

		if (this.schema.methods.onCreated) {
			this.schema.methods.onCreated(this.io);
		}


	},

	/**
	 * Service started lifecycle event handler
	 */
	started() {


		// console.log("--", this);

		return Promise.all(
				[
					this.createService.bind(this, this.io).call()
				]
			)
			.then(() => {

				console.log(`Events : `, this.hash_events);
				console.log(`Middlewares : `, this.hash_middlewares);

				this.server.on('error', (e) => {
					console.log('ERROR ERROR', e);
				});

				this.server.listen(
					this.schema.settings.port,
					() => {
						console.log(`listening on *:${this.schema.settings.port}`);
					}
				);
			})
			.catch((error) => {
				this.logger.error(error);
				return error;
			})
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};
