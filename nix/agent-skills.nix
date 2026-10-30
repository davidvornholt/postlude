# Postlude's agent skills in share/postlude/skills/<skill>, the layout nix-config
# links into ~/.agents/skills. passthru.skills names them. The command the
# skills describe runs in the released image on the server; on a workstation,
# `postlude` is nix-config's SSH wrapper around it.
{
  lib,
  stdenvNoCC,
  version,
}:
let
  pname = "postlude";
  skills = builtins.attrNames (
    lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ../apps/web/skills)
  );
in
stdenvNoCC.mkDerivation {
  inherit pname version;
  src = ../apps/web/skills;
  dontConfigure = true;
  dontBuild = true;
  installPhase = ''
    runHook preInstall
    mkdir -p "$out/share/${pname}"
    cp -r . "$out/share/${pname}/skills"
    runHook postInstall
  '';
  passthru = { inherit skills; };
  meta = {
    description = "Agent skills for the postlude command";
    platforms = lib.platforms.all;
  };
}
