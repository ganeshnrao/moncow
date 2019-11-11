# moncow

You can run any file that looks like the following with keyboard shortcut Cmd+Shift+1 and it will load the result returned by `main` function in a new editor.

```js
// moncow
// you can require lodash, bluebird, and moment here
async function main() {
  const { QikSayDB } = await connect(
    "vagrant", // can be vagrant, development, staging, production
    ["QikSayDB"] // can use any TVL DB names here
  );
  return QikSayDB.collection("organizations")
    .find({ longName: /facebook/i })
    .toArray()
}
return main(); // you must return the invoked main function
```