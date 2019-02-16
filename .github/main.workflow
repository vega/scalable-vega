workflow "Deploy Workflow" {
  on = "push"
  resolves = [
    "Deploy"
  ]
}

action "Deploy" {
  uses = "actions/npm@59b64a598378f31e49cb76f27d6f3312b582f680"
  args = "deploy"
}
