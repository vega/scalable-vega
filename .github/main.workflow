workflow "Deploy Workflow" {
  on = "push"
  resolves = [
    "Deploy"
  ]
}

action "Install" {
  uses = "borales/actions-yarn@master"
  args = "install"
}

action "Build" {
  uses = "borales/actions-yarn@master"
  needs = ["Install"]
  args = "build"
}

action "Deploy" {
  uses = "maxheld83/ghpages@v0.2.0"
  needs = ["Build"]
  env = {
    BUILD_DIR = "dist/"
  }
  secrets = ["GH_PAT"]
}
