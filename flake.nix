{
  description = "Node.js v24 + npm";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        bashInteractive = pkgs.bashInteractive;
        deno = pkgs.deno;
      in {
        devShells.default = pkgs.mkShell {
          nativeBuildInputs = [
            bashInteractive
          ];

          buildInputs = [
            deno
          ];

          shellHook = ''
            echo "Deno: $(deno --version)"
          '';
        };
      });
}
