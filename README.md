# moncow

Moncow allows you to run files that look like the following example with a key board shprtcut `Cmd+Shift+1`. The resulting JSON will be loaded in a separate editor beside the current.

```js
// moncow
// You can `require("lodash" | "bluebird" | "moment")`
// You must set the module.exports to a function
// which is the only function that will be run.
module.exports = async function main() {
  const { MyDB } = await connect(
    "local", // one environment defined in `moncow.connections`
    ["MyDB"] // one or many databases defined in `moncow.connections`
  );
  // Find all recipes that use broccoli
  return MyDB.collection("recipes")
    .find({ ingredients: "broccoli" })
    .toArray()
}
```

## Caveats
* You file must start with `// moncow` on the first line.
* Any `console.log` statements used within the file will be visible in the "Extensions" section of the "Output" window.

## Keybindings
`Cmd+Shift+1` create a new file with a moncow boilerplate
`Cmd+Shift+2` execute current file and show results

## Commands
`Moncow: Show list` - shows list of all currently active connections
`Moncow: End all` - ends all active connections

## Config
Edit the user settings and create an entry like the following.
```jsonc
"moncow.connections": [
  {
    "environment": "vagrant", // name of environment, used to connect to it
    "connectionConfigs": [
      {
        "url": "mongodb://localhost:27017", // connect to Mongo via this url
        "dbNames": [ // following databases will be available in your files
          "Users",
          "Profiles",
          "Transactions"
        ]
      }
    ]
  }
]
```

You can also connect via tunnels.
```jsonc
"moncow.connections": [
  {
    "environment": "production",
    "connectionConfigs": [
      {
        "url": "users.myapp.com",
        "tunnel": true, // moncow will automatically connect to port 27017 of the url and map it internally to a port and connect to it.
        "dbNames": [ // following databases will be available in your files
          "Users",
          "Profiles"
        ]
      },
      {
        "url": "transactions.myapp.com",
        "tunnel": true,
        "dbNames": [
          "Transactions"
        ]
      },
    ]
  }
]
```