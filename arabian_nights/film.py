"""Arabian Nights — talking genie short (13 s @ 24 fps).

Builds the palace environment (scene.py), then adds a fully animated,
lip-synced genie rising from a brass lamp.

Run:  python film.py --frames 1 312 --samples 24 --res 100 --out frames/
"""
import os, sys, json, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
NF = 312
G = {"FILM": True, "N_FRAMES": NF, "__name__": "__main__", "__file__": os.path.join(HERE, "scene.py")}
exec(compile(open(os.path.join(HERE, "scene.py")).read(), "scene.py", "exec"), G)

import bpy
from mathutils import Vector, Matrix, Quaternion, Euler

scene = G["scene"]; mat = G["mat"]; link = G["link"]; lathe = G["lathe"]
GOLD = G["GOLD"]; SPARK = G["SPARK"]; args = G["args"]
scene.frame_start, scene.frame_end = args.frames
random.seed(11)

# remove the environment-only camera
for n in ("Camera", "CamTarget"):
    if n in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)

# move the moon so it sits between genie and palace, re-aim moonlight
moon = bpy.data.objects["Moon"]
moon.location = (-5, 420, 120)
sun = bpy.data.objects["Sun"]
sun.rotation_euler = (Vector((0, 0, 0)) - moon.location).normalized().to_track_quat("-Z", "Y").to_euler()

dg = bpy.context.evaluated_depsgraph_get()
def ground(x, y):
    hit, loc, *_ = scene.ray_cast(dg, (x, y, 200), (0, 0, -1))
    return loc.z if hit else 0.0

def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.parent = parent; e.location = loc
    e.empty_display_size = 0.2
    return e

def sphere(name, r, loc, scale=(1, 1, 1), m=None, parent=None, rot=(0, 0, 0), seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=(0, 0, 0))
    o = bpy.context.object; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    o.parent = parent; o.location = loc; o.scale = scale; o.rotation_euler = rot
    if m: o.data.materials.append(m)
    return o

def torus(name, R, r, loc, m, parent=None, rot=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=64, minor_segments=24)
    o = bpy.context.object; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    o.parent = parent; o.location = loc; o.rotation_euler = rot; o.scale = scale
    o.data.materials.append(m)
    return o

def nurbs(name, pts, radii, bevel, m, parent=None, order=3, res=24):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = bevel; cu.bevel_resolution = 8; cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
    for p, c, r in zip(sp.points, pts, radii):
        p.co = (*c, 1); p.radius = r
    sp.order_u = order; sp.use_endpoint_u = True; sp.use_smooth = True
    o = bpy.data.objects.new(name, cu); scene.collection.objects.link(o)
    o.parent = parent
    cu.materials.append(m)
    return o

def smooth(o, lvl=2):
    m = o.modifiers.new("Sub", "SUBSURF"); m.levels = lvl; m.render_levels = lvl
    return o

# ------------------------------------------------------------------ materials
def principled(name, color, rough=0.5, metal=0.0, sss=0.0, coat=0.0, sheen=0.0, emit=None, es=0.0):
    def b(nt, out):
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        p.inputs["Base Color"].default_value = (*color, 1)
        p.inputs["Roughness"].default_value = rough
        p.inputs["Metallic"].default_value = metal
        if sss:
            p.inputs["Subsurface Weight"].default_value = sss
            p.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.6)
            p.inputs["Subsurface Scale"].default_value = 0.02
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Sheen Weight"].default_value = sheen
        if emit:
            p.inputs["Emission Color"].default_value = (*emit, 1)
            p.inputs["Emission Strength"].default_value = es
        link(nt, p.outputs[0], out.inputs[0])
    return mat(name, b)

SKIN_C = (0.20, 0.05, 0.42)
SKIN = principled("Skin", SKIN_C, 0.42, sss=0.35, coat=0.08, sheen=0.15)
LIP = principled("Lip", (0.20, 0.04, 0.30), 0.35, sss=0.3)
HAIR = principled("Hair", (0.025, 0.008, 0.04), 0.45, sheen=0.5)
EYEW = principled("EyeWhite", (0.92, 0.90, 0.86), 0.05, sss=0.15, coat=1.0)
IRIS = principled("Iris", (0.55, 0.28, 0.04), 0.15, coat=1.0, emit=(1.0, 0.55, 0.1), es=0.25)
PUPIL = principled("Pupil", (0.0, 0.0, 0.0), 0.05, coat=1.0)
HILITE = G["mat"]("Hilite", G["glow_build"]((1, 1, 1, 1), 8))
MOUTH = principled("MouthIn", (0.10, 0.005, 0.03), 0.6)
TONGUE = principled("Tongue", (0.55, 0.10, 0.22), 0.35, sss=0.3)
TEETH = principled("Teeth", (0.95, 0.93, 0.86), 0.2, coat=0.6)
RUBY = principled("Ruby", (0.8, 0.02, 0.06), 0.02, coat=1.0, emit=(1, 0.05, 0.1), es=0.6)
BRASS = principled("Brass", (1.0, 0.68, 0.32), 0.18, metal=1.0)

def turban_build(nt, out):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Roughness"].default_value = 0.6; p.inputs["Sheen Weight"].default_value = 0.8
    tc = nt.nodes.new("ShaderNodeTexCoord")
    w = nt.nodes.new("ShaderNodeTexWave"); w.inputs["Scale"].default_value = 6
    w.inputs["Distortion"].default_value = 1.5; w.bands_direction = "DIAGONAL"
    link(nt, tc.outputs["Object"], w.inputs["Vector"])
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color = (0.72, 0.42, 0.14, 1)
    r.color_ramp.elements[1].color = (0.93, 0.78, 0.50, 1)
    link(nt, w.outputs["Fac"], r.inputs["Fac"]); link(nt, r.outputs["Color"], p.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    link(nt, w.outputs["Fac"], bump.inputs["Height"]); link(nt, bump.outputs[0], p.inputs["Normal"])
    link(nt, p.outputs[0], out.inputs[0])
TURBAN = mat("Turban", turban_build)

def body_build(nt, out):
    """skin chest with an open red vest (gold trim) on the sides/back."""
    skin = nt.nodes.new("ShaderNodeBsdfPrincipled")
    skin.inputs["Base Color"].default_value = (*SKIN_C, 1); skin.inputs["Roughness"].default_value = 0.42
    skin.inputs["Subsurface Weight"].default_value = 0.35
    skin.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.6)
    skin.inputs["Subsurface Scale"].default_value = 0.02
    skin.inputs["Sheen Weight"].default_value = 0.15
    vest = nt.nodes.new("ShaderNodeBsdfPrincipled")
    vest.inputs["Base Color"].default_value = (0.42, 0.02, 0.05, 1); vest.inputs["Roughness"].default_value = 0.55
    vest.inputs["Sheen Weight"].default_value = 1.0
    gold = nt.nodes.new("ShaderNodeBsdfPrincipled")
    gold.inputs["Base Color"].default_value = (1.0, 0.68, 0.3, 1); gold.inputs["Metallic"].default_value = 1
    gold.inputs["Roughness"].default_value = 0.25
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, tc.outputs["Object"], sep.inputs[0])
    # vest boundary: angle around Z  -> |atan2(x, -y)| > 0.55 rad is vest
    at = nt.nodes.new("ShaderNodeMath"); at.operation = "ARCTAN2"
    ny = nt.nodes.new("ShaderNodeMath"); ny.operation = "MULTIPLY"; ny.inputs[1].default_value = -1
    link(nt, sep.outputs["Y"], ny.inputs[0])
    link(nt, sep.outputs["X"], at.inputs[0]); link(nt, ny.outputs[0], at.inputs[1])
    ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"; link(nt, at.outputs[0], ab.inputs[0])
    # widen opening toward the bottom
    zz = nt.nodes.new("ShaderNodeMath"); zz.operation = "MULTIPLY_ADD"
    zz.inputs[1].default_value = -0.35; zz.inputs[2].default_value = 0.55
    link(nt, sep.outputs["Z"], zz.inputs[0])
    d = nt.nodes.new("ShaderNodeMath"); d.operation = "SUBTRACT"
    link(nt, ab.outputs[0], d.inputs[0]); link(nt, zz.outputs[0], d.inputs[1])
    isv = nt.nodes.new("ShaderNodeMath"); isv.operation = "GREATER_THAN"; isv.inputs[1].default_value = 0.0
    link(nt, d.outputs[0], isv.inputs[0])
    trim = nt.nodes.new("ShaderNodeMath"); trim.operation = "COMPARE"
    trim.inputs[1].default_value = 0.06; trim.inputs[2].default_value = 0.06
    link(nt, d.outputs[0], trim.inputs[0])
    m1 = nt.nodes.new("ShaderNodeMixShader"); link(nt, isv.outputs[0], m1.inputs[0])
    link(nt, skin.outputs[0], m1.inputs[1]); link(nt, vest.outputs[0], m1.inputs[2])
    m2 = nt.nodes.new("ShaderNodeMixShader"); link(nt, trim.outputs[0], m2.inputs[0])
    link(nt, m1.outputs[0], m2.inputs[1]); link(nt, gold.outputs[0], m2.inputs[2])
    link(nt, m2.outputs[0], out.inputs[0])
BODY = mat("Body", body_build)

def smoke_build(nt, out):
    """skin at the waist dissolving into glowing magic smoke toward the lamp."""
    skin = nt.nodes.new("ShaderNodeBsdfPrincipled")
    skin.inputs["Base Color"].default_value = (*SKIN_C, 1); skin.inputs["Roughness"].default_value = 0.45
    skin.inputs["Subsurface Weight"].default_value = 0.3
    skin.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.6)
    skin.inputs["Subsurface Scale"].default_value = 0.02
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (0.55, 0.35, 1.0, 1)
    em.inputs["Strength"].default_value = 4
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, tc.outputs["Generated"], sep.inputs[0])
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 4
    noise.inputs["Detail"].default_value = 6
    link(nt, tc.outputs["Object"], noise.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.35
    link(nt, noise.outputs["Fac"], add.inputs[0]); link(nt, sep.outputs["Z"], add.inputs[2])
    rmp = nt.nodes.new("ShaderNodeMapRange")
    rmp.inputs["From Min"].default_value = 0.55; rmp.inputs["From Max"].default_value = 0.95
    link(nt, add.outputs[0], rmp.inputs["Value"])
    m_em = nt.nodes.new("ShaderNodeMixShader")
    link(nt, rmp.outputs[0], m_em.inputs[0]); link(nt, em.outputs[0], m_em.inputs[1]); link(nt, skin.outputs[0], m_em.inputs[2])
    alpha = nt.nodes.new("ShaderNodeMapRange")
    alpha.inputs["From Min"].default_value = 0.2; alpha.inputs["From Max"].default_value = 0.6
    alpha.inputs["To Min"].default_value = 0.25; alpha.inputs["To Max"].default_value = 1.0
    link(nt, add.outputs[0], alpha.inputs["Value"])
    m_tr = nt.nodes.new("ShaderNodeMixShader")
    link(nt, alpha.outputs[0], m_tr.inputs[0]); link(nt, tr.outputs[0], m_tr.inputs[1]); link(nt, m_em.outputs[0], m_tr.inputs[2])
    link(nt, m_tr.outputs[0], out.inputs[0])
SMOKE = mat("Smoke", smoke_build)

# ------------------------------------------------------------------ lamp
LX, LY = -3.0, -20.0
LZ = ground(LX, LY)
LS = 2.0
lamp = empty("Lamp", None, (LX, LY, LZ - 0.02))
lamp.rotation_euler = (0, 0, math.radians(-35)); lamp.scale = (LS, LS, LS)
lathe("LampBody", [(0, 0), (0.18, 0), (0.2, 0.03), (0.12, 0.08), (0.10, 0.12), (0.25, 0.16), (0.33, 0.24),
                   (0.32, 0.32), (0.22, 0.38), (0.12, 0.42), (0.10, 0.46), (0.14, 0.47), (0.12, 0.52),
                   (0.06, 0.56), (0.02, 0.62), (0, 0.64)], 64, (0, 0, 0), BRASS).parent = lamp
nurbs("Spout", [(0.22, 0, 0.26), (0.45, 0, 0.28), (0.6, 0, 0.40), (0.72, 0, 0.50)],
      [1.0, 0.7, 0.45, 0.35], 0.09, BRASS, lamp)
nurbs("Handle", [(-0.28, 0, 0.34), (-0.48, 0, 0.40), (-0.50, 0, 0.24), (-0.30, 0, 0.18)],
      [1, 1, 1, 1], 0.025, BRASS, lamp)
sphere("LampJewel", 0.04, (0, -0.33, 0.28), m=RUBY, parent=lamp)
bpy.context.view_layer.update()
SPOUT = lamp.matrix_world @ Vector((0.74, 0, 0.52))
bpy.ops.object.light_add(type="POINT", location=SPOUT + Vector((0, 0, 0.3)))
lampglow = bpy.context.object; lampglow.data.color = (0.7, 0.45, 1.0); lampglow.data.shadow_soft_size = 0.3

# ------------------------------------------------------------------ genie rig
root = empty("GenieRoot")
torso = empty("Torso", root)
neck = empty("Neck", torso, (0, 0, 0.78))
head = empty("Head", neck, (0, 0, 0.52))

# torso
tb = lathe("TorsoMesh", [(0.0, -1.05), (0.42, -1.05), (0.50, -0.75), (0.66, -0.35), (0.80, 0.05), (0.86, 0.30),
                         (0.80, 0.50), (0.55, 0.66), (0.30, 0.76), (0.22, 0.86), (0.0, 0.9)], 64, (0, 0, 0), BODY)
tb.parent = torso; tb.scale = (1, 0.72, 1); smooth(tb, 1)
# pecs / belly hints
for sx in (-1, 1):
    sphere(f"Shoulder{sx}", 0.21, (0.74 * sx, 0, 0.42), (1, 1, 1), SKIN, torso)
torus("Belt", 0.47, 0.085, (0, 0, -0.92), GOLD, torso, scale=(1, 0.75, 1))
torus("Sash", 0.50, 0.10, (0, 0, -0.80), mat("Sash", G["glow_build"]((0, 0, 0, 1), 0)) if False else principled("SashM", (0.05, 0.25, 0.30), 0.5, sheen=1), torso, scale=(1, 0.76, 0.8))
sphere("BeltGem", 0.07, (0, -0.44, -0.9), (1, 0.6, 1.2), RUBY, torso)

# head
sphere("HeadMesh", 0.5, (0, 0, 0), (1.0, 0.95, 1.04), SKIN, head)
sphere("Cheeks", 0.36, (0, -0.25, -0.17), (1.15, 0.85, 0.7), SKIN, head)
sphere("Muzzle", 0.25, (0, -0.37, -0.22), (1.15, 0.8, 0.85), SKIN, head)
sphere("Chin", 0.16, (0, -0.33, -0.43), (1.1, 0.9, 0.8), SKIN, head)
sphere("Nose", 0.12, (0, -0.55, -0.02), (1.0, 1.1, 0.9), SKIN, head)
for sx in (-1, 1):
    sphere(f"Nostril{sx}", 0.045, (0.07 * sx, -0.6, -0.08), (1, 1, 0.8), SKIN, head)
    ear = sphere(f"Ear{sx}", 0.1, (0.48 * sx, 0.0, 0.02), (0.55, 0.9, 2.0), SKIN, head,
                 rot=(0, math.radians(-38 * sx), 0))
    torus(f"Earring{sx}", 0.07, 0.014, (0.5 * sx, -0.02, -0.22), GOLD, head, rot=(0, math.radians(90), 0))

# turban
tbase = empty("TurbanBase", head, (0, 0.06, 0.41))
torus("Turban1", 0.43, 0.15, (0, 0, 0), TURBAN, tbase, rot=(math.radians(-8), 0, 0))
torus("Turban2", 0.34, 0.14, (0, 0.02, 0.17), TURBAN, tbase, rot=(math.radians(6), 0, math.radians(30)))
sphere("Turban3", 0.33, (0, 0.03, 0.22), (1, 1, 0.85), TURBAN, tbase)
sphere("TurbanTop", 0.13, (0, 0.06, 0.48), (1, 1, 1.1), TURBAN, tbase)
torus("JewelSet", 0.075, 0.02, (0, -0.57, 0.03), GOLD, tbase, rot=(math.radians(90), 0, 0))
sphere("Jewel", 0.075, (0, -0.58, 0.03), (1, 0.6, 1.15), RUBY, tbase)
plume = nurbs("Plume", [(0, -0.55, 0.12), (0.02, -0.5, 0.35), (0.12, -0.35, 0.55), (0.28, -0.2, 0.62)],
              [1.0, 1.2, 0.9, 0.2], 0.05, principled("PlumeM", (0.9, 0.85, 0.75), 0.6, sheen=1), tbase)

# eyes
eye_piv, lids_up, lids_lo, brows = [], [], [], []
EYE_R = 0.145
for sx in (-1, 1):
    c = (0.19 * sx, -0.37, 0.10)
    sphere(f"EyeBall{sx}", EYE_R, c, m=EYEW, parent=head)
    piv = empty(f"EyePiv{sx}", head, c)
    sphere(f"Iris{sx}", 0.072, (0, -EYE_R * 0.93, 0), (1, 0.32, 1), IRIS, piv)
    sphere(f"Pupil{sx}", 0.038, (0, -0.152, 0), (1, 0.3, 1), PUPIL, piv)
    sphere(f"Hilite{sx}", 0.014, (-0.025, -0.166, 0.03), m=HILITE, parent=piv, seg=12)
    eye_piv.append(piv)
    rr = EYE_R * 1.07
    up = lathe(f"LidUp{sx}", [(rr * math.sin(t), rr * math.cos(t)) for t in [i * math.pi / 2 / 12 for i in range(13)]] +
               [(rr * 0.92, 0)], 48, (0, 0, 0), SKIN)
    up.parent = head; up.location = c
    lo = lathe(f"LidLo{sx}", [(rr * 0.92, 0)] + [(rr * math.sin(t), -rr * math.cos(t)) for t in [math.pi / 2 - i * math.pi / 2 / 12 for i in range(13)]],
               48, (0, 0, 0), SKIN)
    lo.parent = head; lo.location = c
    lids_up.append(up); lids_lo.append(lo)
    br = sphere(f"Brow{sx}", 0.1, (0.2 * sx, -0.43, 0.275), (1.5, 0.42, 0.38), HAIR, head)
    brows.append(br)

# mouth (scaled group) — sits on the muzzle, under the mustache
mouth = empty("Mouth", head, (0, -0.565, -0.27))
mouth.rotation_euler = (math.radians(-12), 0, 0)
lips = torus("Lips", 0.12, 0.032, (0, 0, 0), LIP, mouth, rot=(math.radians(90), 0, 0))
inner = sphere("MouthIn", 0.12, (0, 0.04, 0), (1, 0.6, 1), MOUTH, mouth)
sphere("Tongue", 0.07, (0, 0.0, -0.07), (1.2, 0.8, 0.5), TONGUE, mouth)
teeth = sphere("Teeth", 0.1, (0, 0.005, 0.085), (1.0, 0.35, 0.28), TEETH, mouth)
for o in (lips, inner):
    sd = o.modifiers.new("Smile", "SIMPLE_DEFORM"); sd.deform_method = "BEND"; sd.deform_axis = "Y"
smile_mods = [lips.modifiers["Smile"], inner.modifiers["Smile"]]

# mustache + goatee curl
for sx in (-1, 1):
    nurbs(f"Mustache{sx}", [(0.0, -0.64, -0.13), (0.14 * sx, -0.62, -0.17), (0.30 * sx, -0.52, -0.15),
                            (0.42 * sx, -0.42, -0.02), (0.38 * sx, -0.44, 0.08), (0.30 * sx, -0.47, 0.04)],
          [1.0, 1.1, 0.8, 0.5, 0.3, 0.1], 0.06, HAIR, head)
nurbs("Goatee", [(0, -0.42, -0.5), (0, -0.44, -0.62), (0.02, -0.38, -0.74), (0.08, -0.33, -0.78)],
      [1.0, 0.8, 0.5, 0.15], 0.06, HAIR, head)

# arms: rubber-hose NURBS tubes, posed per frame
arm_curves, hands, cuffs = {}, {}, {}
SH = {1: Vector((0.80, 0.0, 0.42)), -1: Vector((-0.80, 0.0, 0.42))}

def make_hand(name, side):
    """cartoon four-finger hand: palm + three fingers + thumb, fingers along +Z."""
    parts = []
    def part(loc, scale, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16, location=loc, rotation=rot)
        p = bpy.context.object; p.scale = scale; parts.append(p)
    part((0, 0, 0.07), (0.105, 0.055, 0.105))
    for i, x in enumerate((-0.062, 0.0, 0.062)):
        ang = math.radians((i - 1) * 10)
        L = 0.085 if i == 1 else 0.075
        part((x + math.sin(ang) * 0.1, -0.012, 0.155 + L * math.cos(ang)), (0.036, 0.036, L),
             (math.radians(-12), ang, 0))
    part((0.10 * side, -0.03, 0.06), (0.034, 0.034, 0.07), (math.radians(-20), math.radians(55 * side), 0))
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o = bpy.context.object; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(SKIN)
    o.rotation_mode = "QUATERNION"; o.parent = torso; o.scale = (1.35, 1.35, 1.35)
    return o

for side in (1, -1):
    arm_curves[side] = nurbs(f"Arm{side}", [tuple(SH[side])] * 4, [1.3, 1.1, 0.9, 0.78], 0.15, SKIN, torso, order=3, res=32)
    hands[side] = make_hand(f"Hand{'L' if side > 0 else 'R'}", side)
    c = torus(f"Cuff{side}", 0.11, 0.035, (0, 0, 0), GOLD, torso); c.rotation_mode = "QUATERNION"
    cuffs[side] = c

# tail: genie body dissolving into smoke that streams from the spout
tail = nurbs("Tail", [(0, 0, -0.9), (0, 0, -1.5), (0, 0, -2.1), (0, 0, -2.6), (0, 0, -3.0)],
             [0.95, 0.72, 0.5, 0.3, 0.12], 0.5, SMOKE, root, order=4, res=32)

# ------------------------------------------------------------------ animation helpers
def ease(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

class Track:
    def __init__(self, keys):
        self.k = sorted(keys, key=lambda x: x[0])
    def __call__(self, f):
        k = self.k
        if f <= k[0][0]: return self._v(k[0][1])
        for (f0, v0), (f1, v1) in zip(k, k[1:]):
            if f0 <= f <= f1:
                t = ease((f - f0) / (f1 - f0))
                v0, v1 = self._v(v0), self._v(v1)
                return v0 + (v1 - v0) * t if not isinstance(v0, float) else v0 + (v1 - v0) * t
        return self._v(k[-1][1])
    @staticmethod
    def _v(v):
        return Vector(v) if isinstance(v, (tuple, list)) else float(v)

# arm poses for the +X side (genie's left, screen right); mirrored for the other side
POSES = {
    #             elbow               wrist              hand roll
    "rest":    ((1.08, 0.05, -0.20), (0.95, -0.25, -0.75), 0.0),
    "up":      ((1.10, 0.05, 1.15), (0.85, 0.0, 1.95), 0.3),
    "hip":     ((1.35, 0.15, -0.25), (0.62, -0.05, -0.80), 1.4),
    "lamp":    ((1.20, -0.35, -0.10), (1.05, -0.95, -0.75), -0.3),
    "wide":    ((1.45, -0.35, 0.10), (2.05, -0.65, 0.35), 1.6),
    "present": ((1.55, -0.15, 0.25), (2.25, -0.45, 0.55), 1.7),
    "chest":   ((1.05, -0.45, -0.15), (0.32, -0.80, 0.18), -1.4),
    "high":    ((1.40, -0.20, 1.05), (1.85, -0.50, 1.75), 1.5),
    "offer":   ((1.20, -0.75, -0.05), (0.85, -1.45, 0.15), 1.6),
    "point":   ((1.05, -0.70, 0.05), (0.60, -1.50, 0.45), 0.0),
    "chin":    ((0.95, -0.55, 0.05), (0.25, -0.75, 0.85), -1.2),
}
def P(name, side, field):
    v = POSES[name][field]
    return (v[0] * side, v[1], v[2]) if field < 2 else v * side

# choreography (frame, poseL(+X), poseR(-X))
CH = [
    (1, "rest", "rest"), (24, "rest", "rest"),
    (34, "up", "up"), (52, "up", "up"),
    (64, "hip", "lamp"), (74, "hip", "lamp"),
    (86, "wide", "wide"), (104, "wide", "wide"),
    (116, "present", "chest"), (156, "present", "chest"),
    (176, "high", "rest"), (196, "high", "high"), (212, "high", "high"),
    (222, "offer", "high"), (232, "offer", "rest"),
    (242, "hip", "chest"), (252, "hip", "chest"),
    (262, "hip", "point"), (284, "hip", "point"),
    (300, "wide", "wide"), (312, "wide", "wide"),
]
arm_tracks = {}
for side in (1, -1):
    idx = 1 if side > 0 else 2
    arm_tracks[side] = (Track([(c[0], P(c[idx], side, 0)) for c in CH]),
                        Track([(c[0], P(c[idx], side, 1)) for c in CH]),
                        Track([(c[0], P(c[idx], side, 2)) for c in CH]))

# root: rise from the lamp with a swirl, then float
CAMX, CAMY = 0.5, -31.0
G_POS = SPOUT + Vector((-0.6, 0.6, 3.25))
yaw0 = math.atan2(-(CAMX - G_POS.x), -(CAMY - G_POS.y)) * -1
root_loc = Track([(1, tuple(SPOUT + Vector((0, 0, 0.2)))), (20, tuple(G_POS + Vector((0, 0, 0.35)))), (30, tuple(G_POS)),
                  (236, tuple(G_POS)), (252, tuple(G_POS + Vector((0.25, -0.9, -0.15)))), (290, tuple(G_POS + Vector((0.25, -0.9, -0.15)))),
                  (312, tuple(G_POS + Vector((0.1, -0.5, 0))))])
root_scale = Track([(1, 0.02), (18, 1.08), (26, 0.97), (32, 1.0)])
root_yaw = Track([(1, yaw0 + math.radians(-540)), (24, yaw0 + math.radians(12)), (32, yaw0)])
# torso lean (x = pitch forward, y = roll, z = twist)
torso_rot = Track([(1, (0, 0, 0)), (30, (0, 0, 0)), (36, (-0.12, 0, 0)), (52, (-0.15, 0, 0)), (64, (0.08, 0.06, 0)),
                   (86, (-0.05, 0, 0)), (116, (0.0, -0.06, 0.18)), (156, (0.0, -0.06, 0.20)), (176, (-0.08, 0, 0.05)),
                   (212, (-0.15, 0.04, 0)), (226, (0.06, 0, 0)), (244, (0.16, 0.05, -0.05)), (284, (0.16, 0.05, -0.05)),
                   (300, (0.0, 0, 0))])
# head (x = nod (+ looks down), y = tilt, z = turn)
head_rot = Track([(1, (0, 0, 0)), (30, (0, 0, 0)), (36, (-0.35, 0.1, 0)), (52, (-0.3, -0.1, 0)), (64, (0.2, 0.12, -0.2)),
                  (74, (0.18, 0.1, -0.15)), (86, (0.0, 0.0, 0.0)), (110, (-0.05, -0.1, 0.45)), (138, (-0.05, -0.12, 0.45)),
                  (154, (0.0, 0.08, 0.0)), (176, (-0.30, 0, 0.05)), (212, (-0.38, 0.05, 0)), (224, (0.0, 0.1, 0.0)),
                  (244, (0.10, 0.18, 0)), (260, (0.05, 0.15, 0)), (272, (0.02, -0.08, 0)), (300, (0.0, 0.1, 0))])
# eye look offsets (x = right, z = up)  — on top of head motion
eye_look = Track([(1, (0, 0)), (36, (0, 0.35)), (60, (0, -0.4)), (70, (-0.2, -0.45)), (84, (0, 0)),
                  (108, (0.45, 0.05)), (150, (0.45, 0.05)), (158, (0, 0)), (178, (0.0, 0.45)), (212, (0.15, 0.5)),
                  (222, (0, 0)), (312, (0, 0))])
# brows: (raise, angry tilt)
brow = Track([(1, (0.0, 0.0)), (30, (0.06, 0)), (40, (0.07, 0.0)), (60, (-0.02, 0.35)), (74, (-0.02, 0.3)),
              (84, (0.07, -0.1)), (110, (0.04, -0.05)), (176, (0.08, -0.15)), (224, (0.05, 0)), (244, (0.02, 0.25)),
              (262, (0.07, -0.1)), (312, (0.05, 0))])
# upper lid opening angle (degrees elevation of lid edge); smile amount
lid_open = Track([(1, 25.0), (30, 25.0), (34, -70.0), (48, -70.0), (54, 18.0), (62, 5.0), (74, 8.0), (84, 30.0),
                  (176, 28.0), (212, 34.0), (244, 12.0), (258, 26.0), (312, 26.0)])
smile = Track([(1, 0.0), (30, 0.3), (60, -0.25), (74, -0.2), (84, 0.6), (156, 0.5), (176, 0.45), (224, 0.7),
               (244, 0.35), (262, 0.7), (312, 0.9)])
BLINKS = [12, 102, 166, 230, 296]

lip = json.load(open(os.path.join(HERE, "lipsync.json")))
OPEN = lip["open"]; WIDE = lip["wide"]
def lipv(arr, f):
    i = f - 1
    a = arr[max(0, min(len(arr) - 1, i))]; b = arr[max(0, min(len(arr) - 1, i + 1))]
    return 0.6 * a + 0.4 * b

def blink(f):
    v = 0.0
    for b in BLINKS:
        d = f - b
        if -2 <= d <= 4: v = max(v, 1 - abs(d - 0 if d < 0 else d / 2) / 2.2)
    return max(0.0, min(1.0, v))

def kq(o, q, f, prev):
    if prev is not None and prev.dot(q) < 0: q = -q
    o.rotation_quaternion = q; o.keyframe_insert("rotation_quaternion", frame=f)
    return q

# ------------------------------------------------------------------ bake every frame
for o in (root, torso, neck, head, mouth, *eye_piv, *lids_up, *lids_lo, *brows):
    o.rotation_mode = "XYZ"
brow_base = [b.location.copy() for b in brows]
lidlo_rot = math.radians(48)
qprev = {1: None, -1: None}; cprev = {1: None, -1: None}
spark_data = [(random.uniform(0, 1), random.uniform(0.5, 2.0), random.uniform(0.15, 0.6), random.random() * 6.28) for _ in range(70)]
sparks = []
for i in range(len(spark_data)):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.012, 0.03), subdivisions=1)
    s = bpy.context.object; s.data.materials.append(SPARK); s.visible_shadow = False; sparks.append(s)

for f in range(1, NF + 1):
    t = f / 24.0
    bob = Vector((0.03 * math.sin(t * 1.7), 0.02 * math.sin(t * 1.1), 0.09 * math.sin(t * 2.1)))
    rl = root_loc(f) + (bob if f > 26 else Vector())
    sc = root_scale(f); yw = root_yaw(f)
    root.location = rl; root.scale = (sc, sc, sc); root.rotation_euler = (0, 0, yw)
    for p in ("location", "scale", "rotation_euler"): root.keyframe_insert(p, frame=f)

    tr = torso_rot(f)
    torso.rotation_euler = (tr.x + 0.02 * math.sin(t * 2.1 + 1), tr.y, tr.z); torso.keyframe_insert("rotation_euler", frame=f)

    op = lipv(OPEN, f); wd = lipv(WIDE, f)
    hr = head_rot(f - 1)  # head slightly lags the body
    nod = 0.05 * op
    head.rotation_euler = (hr.x + nod + 0.015 * math.sin(t * 3.3), hr.y + 0.02 * math.sin(t * 1.3), hr.z)
    head.keyframe_insert("rotation_euler", frame=f)

    # mouth
    sm = smile(f)
    mouth.scale = (1.0 + 0.25 * wd + 0.12 * sm - 0.15 * op, 1.0, 0.18 + 1.25 * op)
    mouth.keyframe_insert("scale", frame=f)
    for m in smile_mods:
        m.angle = math.radians(-55 * sm); m.keyframe_insert("angle", frame=f)

    # eyes
    el = eye_look(f)
    for piv in eye_piv:
        piv.rotation_euler = (el.y * 0.5 + 0.0, 0, el.x * 0.6); piv.keyframe_insert("rotation_euler", frame=f)
    lo = lid_open(f); bl = blink(f)
    elev = lo + (-75 - lo) * bl
    for up in lids_up:
        up.rotation_euler = (math.radians(-elev) + el.y * 0.25, 0, 0); up.keyframe_insert("rotation_euler", frame=f)
    for lw in lids_lo:
        lw.rotation_euler = (lidlo_rot - math.radians(10 * sm), 0, 0); lw.keyframe_insert("rotation_euler", frame=f)
    bw = brow(f)
    for i, (b, base) in enumerate(zip(brows, brow_base)):
        sx = -1 if i == 0 else 1
        lift = bw.x + 0.02 * op + (0.03 if (f > 258 and sx > 0) else 0)
        b.location = base + Vector((0, 0, lift)); b.rotation_euler = (0, sx * bw.y + sx * 0.1, 0)
        b.keyframe_insert("location", frame=f); b.keyframe_insert("rotation_euler", frame=f)

    # arms with overlapping action (wrist lags elbow)
    for side in (1, -1):
        E_t, W_t, R_t = arm_tracks[side]
        S = SH[side]; E = E_t(f) + Vector((0, 0, 0.02 * math.sin(t * 2 + side))); W = W_t(f - 2)
        roll = R_t(f - 3)
        sp = arm_curves[side].data.splines[0]
        pts = [S, S.lerp(E, 0.55) + Vector((0, 0, 0.04)), E, W]
        for pt, v in zip(sp.points, pts):
            pt.co = (*v, 1); pt.keyframe_insert("co", frame=f)
        d = (W - E).normalized()
        q = d.to_track_quat("Z", "Y") @ Quaternion((0, 0, 1), roll)
        hands[side].location = W + d * 0.02; hands[side].keyframe_insert("location", frame=f)
        qprev[side] = kq(hands[side], q, f, qprev[side])
        cuffs[side].location = W - d * 0.05; cuffs[side].keyframe_insert("location", frame=f)
        cprev[side] = kq(cuffs[side], d.to_track_quat("Z", "Y"), f, cprev[side])

    # tail: from waist to spout, in root space
    M = Matrix.LocRotScale(rl, Euler((0, 0, yw)), Vector((sc, sc, sc)))
    end = M.inverted() @ SPOUT
    top = Vector((0, 0, -0.9))
    sp = tail.data.splines[0]
    for i, pt in enumerate(sp.points):
        a = i / (len(sp.points) - 1)
        base = top.lerp(end, a)
        sway = Vector((0.35 * math.sin(t * 2.2 + a * 3.5), 0.25 * math.cos(t * 1.7 + a * 3.0), 0)) * math.sin(a * math.pi)
        curl = Vector((0.5 * math.sin(a * math.pi) * (1 if a < 0.6 else 0.6), 0, 0))
        v = base + sway + curl
        pt.co = (*v, 1); pt.keyframe_insert("co", frame=f)

    # magic sparks swirling up the smoke column
    if f % 2 == 1:
        Mw = M
        for s, (ph, spd, rad, a0) in zip(sparks, spark_data):
            u = (ph + t * spd * 0.25) % 1.0
            p_local = top.lerp(end, 1 - u)
            ang = a0 + t * spd * 3
            p_local = p_local + Vector((math.cos(ang), math.sin(ang), 0)) * (rad * (0.4 + u))
            s.location = Mw @ p_local
            k = math.sin(u * math.pi) * (1 if f > 3 else 0)
            s.scale = (k, k, k)
            s.keyframe_insert("location", frame=f); s.keyframe_insert("scale", frame=f)

    lampglow.data.energy = 25 + 300 * max(0, 1 - f / 30) + 20 * math.sin(t * 9)
    lampglow.data.keyframe_insert("energy", frame=f)

# ------------------------------------------------------------------ character lighting
def area(name, loc, target, energy, color, size):
    bpy.ops.object.light_add(type="AREA", location=loc)
    L = bpy.context.object; L.name = name; L.data.energy = energy; L.data.color = color
    L.data.size = size; L.data.shape = "DISK"
    L.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return L
gp = G_POS
area("Key", gp + Vector((-4.5, -5.0, 3.0)), gp + Vector((0, 0, 0.6)), 500, (1.0, 0.72, 0.48), 3.0)
area("Rim", gp + Vector((3.5, 5.0, 3.0)), gp + Vector((0, 0, 0.8)), 1100, (0.45, 0.6, 1.0), 2.0)
area("RimL", gp + Vector((-4.0, 4.0, 2.0)), gp + Vector((0, 0, 0.5)), 350, (0.9, 0.5, 1.0), 2.0)
area("Fill", gp + Vector((2.0, -7.0, 0.5)), gp + Vector((0, 0, 0.6)), 90, (0.55, 0.6, 1.0), 4.0)
area("EyeLight", gp + Vector((0.3, -6.0, 1.6)), gp + Vector((0, 0, 1.3)), 25, (1, 0.95, 0.9), 0.6)

# ------------------------------------------------------------------ camera
bpy.ops.object.camera_add(); cam = bpy.context.object; cam.name = "FilmCam"; scene.camera = cam
cam.data.lens = 35; cam.data.sensor_width = 36
cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = 2.8; cam.data.dof.aperture_blades = 7
aim = empty("Aim"); tt = cam.constraints.new("TRACK_TO"); tt.target = aim
tt.track_axis = "TRACK_NEGATIVE_Z"; tt.up_axis = "UP_Y"
focus = empty("Focus"); cam.data.dof.focus_object = focus
gz = ground(CAMX, CAMY)
cam_tr = Track([(1, (CAMX + 1.5, CAMY + 1.0, 3.6)), (40, (CAMX + 1.0, CAMY + 3.0, 4.9)),
                (160, (CAMX - 0.2, CAMY + 4.5, 5.3)), (312, (CAMX - 1.0, CAMY + 6.0, 5.6))])
aim_tr = Track([(1, tuple(SPOUT + Vector((0.6, 0, 1.6)))), (30, tuple(G_POS + Vector((1.2, 0, 0.3)))),
                (160, tuple(G_POS + Vector((1.0, 0, 0.6)))), (312, tuple(G_POS + Vector((0.8, 0, 0.9))))])
for f in range(1, NF + 1, 2):
    cam.location = cam_tr(f); cam.keyframe_insert("location", frame=f)
    aim.location = aim_tr(f); aim.keyframe_insert("location", frame=f)
    hpos = root_loc(f) + Vector((0, 0, 1.6 * root_scale(f)))
    focus.location = hpos; focus.keyframe_insert("location", frame=f)

# ------------------------------------------------------------------ render
scene.cycles.samples = args.samples
scene.cycles.adaptive_threshold = 0.02
scene.cycles.max_bounces = 6; scene.cycles.transparent_max_bounces = 16
scene.view_settings.exposure = 0.0
scene.render.film_transparent = False
if os.environ.get("SAVE_BLEND"):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "arabian_nights.blend"))
bpy.ops.render.render(animation=True)
