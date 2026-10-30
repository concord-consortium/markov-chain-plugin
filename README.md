# Markov Chain Plugin

## Development

### Initial steps

1. Clone this repo and `cd` into it
2. Run `nvm use` to switch to the Node version in `.nvmrc` (or install that version another way)
3. Run `npm install` to pull dependencies
4. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

#### Run using HTTPS

Additional steps are required to run using HTTPS.

1. install [mkcert](https://github.com/FiloSottile/mkcert) : `brew install mkcert` (install using Scoop or Chocolatey on Windows)
2. Create and install the trusted CA in keychain if it doesn't already exist:   `mkcert -install`
3. Ensure you have a `.localhost-ssl` certificate directory in your home directory (create if needed, typically `C:\Users\UserName` on Windows) and cd into that directory
4. Make the cert files: `mkcert -cert-file localhost.pem -key-file localhost.key localhost 127.0.0.1 ::1`
5. Run `npm run start:secure` to run `webpack-dev-server` in development mode with hot module replacement

### Building

If you want to build a local version run `npm run build`, it will create the files in the `dist` folder.
You *do not* need to build to deploy the code, that is automatic.  See more info in the Deployment section below.

### Notes

1. Make sure if you are using Visual Studio Code that you use the workspace version of TypeScript.
   To ensure that you are open a TypeScript file in VSC and then click on the version number next to
   `TypeScript React` in the status bar and select 'Use Workspace Version' in the popup menu.

## Deployment

Follow the instructions in this
[Guide](https://docs.google.com/document/d/1EacCSUhaHXaL8ll8xjcd4svyguEO-ipf5aF980-_q8E)
to setup an S3 & Cloudfront distribution that can be used with Github actions.
See also `.github/workflows/ci.yml` and `.github/workflows/release.yml`.

Production releases to S3 are based on the contents of the /dist folder and are built automatically by GitHub Actions
for each branch and tag pushed to GitHub, using [s3-deploy-action](https://github.com/concord-consortium/s3-deploy-action).

Branches are deployed to `https://models-resources.concord.org/markov-chain-plugin/branch/<name>/index.html`.
A Jira key prefix is stripped from the branch name, so `MARK-123-my-feature` is deployed to `branch/my-feature/`.

Tags are deployed to `https://models-resources.concord.org/markov-chain-plugin/version/<name>/index.html`.

Pushing `master` also copies its `index-top.html` to https://models-resources.concord.org/markov-chain-plugin/index-master.html,
which loads its assets the same way the released `index.html` does.

The released version is https://models-resources.concord.org/markov-chain-plugin/index.html. Only the release workflow below changes it.

To try a deployed build in CODAP, pass its URL in the `di` parameter, for example
https://codap.concord.org/app/?di=https://models-resources.concord.org/markov-chain-plugin/branch/master/index.html.
To open an existing document with a branch build in place of the plugin it saved, also add
`&di-override=markov-chain-plugin` to the CODAP URL.

To deploy a production release:

1. Increment version number in package.json (the plugin reports this version to CODAP)
2. Create new entry in CHANGELOG.md
3. Run `git log --merges --reverse --format='%s | %b' <last release tag>..HEAD` to list the merged PRs and add contents (after edits if needed to CHANGELOG.md)
4. Create `release-<version>` branch and commit changes, push to GitHub, create PR and merge
5. Checkout master and pull
6. Create an annotated tag for the version, of the form `v[x].[y].[z]`, include at least the version in the tag message. On the command line this can be done with a command like `git tag -a v1.2.3 -m "1.2.3 some info about this version"`
7. Push the tag to github with a command like: `git push origin v1.2.3`.
8. Check that the tag's CI run deployed https://models-resources.concord.org/markov-chain-plugin/version/v1.2.3/index-top.html.
9. Use https://github.com/concord-consortium/markov-chain-plugin/releases to make this tag into a GitHub release.
10. Run the release workflow to update https://models-resources.concord.org/markov-chain-plugin/index.html.
    1. Navigate to the actions page in GitHub and the click the "Release" workflow. This should take you to this page: https://github.com/concord-consortium/markov-chain-plugin/actions/workflows/release.yml.
    2. Click the "Run workflow" menu button.
    3. Type in the tag name you want to release for example `v1.2.3`.  (Note this won't work until the PR has been merged to master)
    4. Click the `Run Workflow` button.

To roll back a release, run the release workflow again with the previous tag.

### Testing

Run `npm test` to run jest tests. Run `npm run test:full` to run jest and Cypress tests. CI runs the jest tests after the build on every push, and a failing test stops the deploy.

The Cypress tests run against the dev server. Start it with `npm start`, then run `npm run test:cypress` to run them all headless, or `npm run test:cypress:open` to open the Cypress app. `npm run test:full` needs the dev server running too. CI runs the Cypress tests in Chrome on every push, a failing test stops the deploy, and a failed run keeps its screenshots as a workflow artifact.

The tests load the plugin into `fake-codap.html`, a stand-in for CODAP that the dev server serves and production builds leave out. It answers the plugin's requests the way CODAP 3.1.2 does and sends it CODAP's notifications. Its code is in `cypress/fake-codap/`, and the custom commands that drive it (`cy.startPlugin`, `cy.dropAttribute`, `cy.getPluginState` and the rest) are listed with their descriptions in `cypress/support/index.d.ts`. `cypress/fixtures/ela/` holds the saved plugin states of the five ELA module documents.

The tests expect the dev server on port 8080. If that port is taken, run the server on another one and point Cypress at it:

```
npm start -- --port 8081
CYPRESS_baseUrl=http://localhost:8081 npm run test:cypress
```

##### Cypress Run Options

Pass these to `npx cypress run`:
1. `--browser browser-name`: the browser to run the tests in (CI uses `chrome`). The click tests in `clicks.test.ts` press the mouse through Chrome's DevTools protocol, so they need Chrome or Electron.
2. `--spec`: the spec files to run
3. `--headed`: show the browser while the tests run
4. `--no-exit`: keep the browser open when the tests finish
5. `--reporter`: a mocha reporter

##### Cypress Run Examples

1. `npx cypress run --browser chrome` runs the tests in Chrome.
2. `npx cypress run --headed --no-exit` shows the tests running and leaves the browser open afterward.
3. `npx cypress run --spec 'cypress/e2e/arrows.test.ts'` runs one spec file.

## License

Markov Chain Plugin is Copyright 2018 (c) by the Concord Consortium and is distributed under the [MIT license](http://www.opensource.org/licenses/MIT).

See license.md for the complete license text.
