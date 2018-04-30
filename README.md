![Moleculer logo](http://moleculer.services/images/banner.png)

# moleculer-socketio [![NPM version](https://img.shields.io/npm/v/moleculer-bee-queue.svg)](https://www.npmjs.com/package/moleculer-socketio)


#   Description

Manage socket.io's namespaces like services and actions.

# Project example

You can find an example of `moleculer-socketio` and `moleculer-nextjs` at [moleculer-nextjs-socketio-example](https://github.com/davidroman0O/moleculer-nextjs-socketio-example)


# Install

```bash
$ npm install moleculer-socketio --save
```

# USAGE

you can use `moleculer-socketio` manage events like actions in services, in `socket.io` it's called `namespaces` so you must add it into your service. 

In socket.io, the root channel is `/` but you can define multiple namespaces !

```javascript
namespaces: {
    "/": {
        //	root namespace
        hello(ctx) {
            this.logger.info("Hello there");
            return "Get this data!";
        }
    },
    "/private": {
		//	another namespace
        hi(ctx) {
            this.logger.info("You're not the droid I'm looking for.")
        }
    }
}
```

On the client side you could connect to those namespaces :

```javascript
const io = require("socket.io-client");

const root = io("http://ip:port");
root.emit("hello");
root.on("hello", (data) => {
    console.log("hello return", data);
});

const private = io("http://ip:port/private");
private.emit("hi")
```

# Events

Every events for each namespaces can be code differently :

```javascript
namespaces: {
    "/": {
        eventA(ctx) {
            return "somedata"
        },
        eventB: {
            //	You can specify parameter validation
            //	Just like actions
            params: {
                parameterA: "string",
                parameterB: "number"
            },
            async handler(ctx) {
				return "somedata again";
            }
       },
       eventC: "service.action",
       eventD: [
		   "service.action",
           function(ctx) {
               return "another data"
           },
           "service.action"
       ]
    }
}
```

When you return data from an event, it will emit an event with it.

# Middlewares

You may want to add some conditions to validate the execution of your actions. You can use a middleware for this case.

```javascript
namespaces: {
    "/private": {
        
        middlewares: [
            function(ctx) {
                if (!ctx.params.crypted) {
                    throw new Error("You're missing crypted parameter");
                }
            }  
        ],
        
        deleteAllUsers: {
            middlewares: [
                function(ctx) {
                    if (!ctx.params.isAdmin) {
                        throw new Error("No, you're not an admin");
                    }
                },
                function(ctx) {
                    if (ctx.params.username != "Icebob") {
                        throw new Error("Sorry, you're not enough badass");
                    }
                }
            ],
            handler(ctx) {
            	return "Destroy everything";    
            }
        }
        
    }
}
```

# Custom response

One more thing, you can also manage custom responses.

```javascript
const SocketIO = require("moleculer-socketio");

module.exports = {
	name: "socket-service",

	mixins: [ SocketIO ],

	settings: {
		port: 5000,
        options: {
			//	Socket.io options
		},
		response: (event, error, results) => {
			// Response Templated
			let payload = {};
			if (!error) {
				if (results.length > 1) {
					results.map((r, index) => {
						payload[event.actions[index]] = r;
					});
				} else {
					payload = results[0];
				}
			}
			return {
				error: error,
				payload: payload
			};
		},
	},
    
};
```

# EXAMPLE

```javascript

const SocketIO = require("moleculer-socketio");

module.exports = {
	name: "socket-service",

	mixins: [ SocketIO ],

	settings: {
		port: 5000,
        options: {
			//	Socket.io options
		},
	},

    actions: {
       
    },

    namespaces: {
        "/": {
            connection(ctx) {
                this.logger.info("Someone is connected");
                ctx.socket.emit("hello", "Welcome to socket.io");
            },
            
            
            
            sendMessage: {
                params: {
                    message: "string"
                },
                async handler(ctx) {
					this.logger.info(ctx.params.message);
                    return true;
                }
            },
            
        },
        
        "/admin": {
            
            middlewares: [
                function(ctx) {
                    if (!ctx.params.isAdmin) {
                        throw new Error("Sorry you can't connect here");
                    }
                }
            ],
            
            connection: {
                middlewares: [
                    function(ctx) {
						if (ctx.params.isAdmin && ctx.) {
                            throw new Error("Sorry you can't connect here");
                        }
                    }
                ],
                async handler(ctx) {
                     this.logger.info("An administrator is connected");
                	ctx.socket.emit("hello", "Welcome to socket.io on admin side");
                }
            }
        }
    },

	methods: {

		onCreated(io) {
			console.log("socket-io.service - onCreated");
			this.io = io;
            this.io.on("oldWay", (socket, data) => {
                this.logger.info("oldWay - ", data);
                socket.emit("oldWay", "You can still to this");
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

