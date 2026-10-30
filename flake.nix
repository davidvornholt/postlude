{
  description = "Postlude development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      manifest = builtins.fromJSON (builtins.readFile ./package.json);
    in
    {
      packages = forAllSystems (
        system:
        let
          agent-skills = nixpkgs.legacyPackages.${system}.callPackage ./nix/agent-skills.nix {
            inherit (manifest) version;
          };
        in
        {
          inherit agent-skills;
          default = agent-skills;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          bun = pkgs.callPackage ./nix/standards-bun.nix {
            inherit (manifest) packageManager;
          };
          localShell =
            if builtins.pathExists ./dev-shell.local.nix then
              import ./dev-shell.local.nix { inherit pkgs; }
            else
              { };
        in
        {
          default = pkgs.mkShell (
            localShell
            // {
              packages = [ bun ] ++ (localShell.packages or [ ]);
            }
          );
        }
      );
    };
}
