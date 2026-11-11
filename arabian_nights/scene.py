"""Arabian Nights — procedural Blender scene (10 s @ 24 fps, 1080p).

Run:  python scene.py [--frames START END] [--samples N] [--out DIR]
"""
import bpy, bmesh, math, random, sys, os, argparse
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--frames", nargs=2, type=int, default=[1, 240])
ap.add_argument("--samples", type=int, default=48)
_HERE = os.path.dirname(os.path.abspath(globals().get("__file__") or "."))
ap.add_argument("--out", default=os.path.join(_HERE, "frames", ""))
ap.add_argument("--gpu", action="store_true", help="render on the graphics card (NVIDIA/AMD/Intel/Apple)")
ap.add_argument("--res", type=int, default=100)
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
FPS, N = 24, globals().get("N_FRAMES", 240)
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, N

# ---------------------------------------------------------------- helpers
def mat(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    build(nt, out)
    return m

def link(nt, a, b):
    nt.links.new(a, b)

def lathe(name, profile, segs=48, loc=(0, 0, 0), mat_=None):
    """Revolve [(radius, z), ...] around Z."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = [bm.verts.new((r * math.cos(2 * math.pi * i / segs),
                              r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = loc
    scene.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = True
    if mat_:
        me.materials.append(mat_)
    return ob

def box(name, size, loc, mat_=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    if mat_:
        ob.data.materials.append(mat_)
    return ob

# ---------------------------------------------------------------- materials
def stone_build(nt, out):
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.55, 0.42, 0.30, 1)
    ramp.color_ramp.elements[1].color = (0.78, 0.64, 0.48, 1)
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    link(nt, noise.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    link(nt, bsdf.outputs[0], out.inputs[0])
STONE = mat("Stone", stone_build)

def gold_build(nt, out):
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (1.0, 0.70, 0.30, 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    link(nt, bsdf.outputs[0], out.inputs[0])
GOLD = mat("Gold", gold_build)

def dome_build(nt, out):
    # teal-glazed tile dome with gold ribs
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "RINGS"
    wave.inputs["Scale"].default_value = 1.2; wave.inputs["Distortion"].default_value = 0
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, tc.outputs["Object"], sep.inputs[0])
    # radial ribs via angle
    math_at = nt.nodes.new("ShaderNodeMath"); math_at.operation = "ARCTAN2"
    link(nt, sep.outputs["Y"], math_at.inputs[0]); link(nt, sep.outputs["X"], math_at.inputs[1])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 8
    link(nt, math_at.outputs[0], mul.inputs[0])
    sn = nt.nodes.new("ShaderNodeMath"); sn.operation = "SINE"
    link(nt, mul.outputs[0], sn.inputs[0])
    rib = nt.nodes.new("ShaderNodeMath"); rib.operation = "GREATER_THAN"; rib.inputs[1].default_value = 0.93
    link(nt, sn.outputs[0], rib.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.03, 0.30, 0.33, 1)
    mix.inputs[7].default_value = (1.0, 0.70, 0.30, 1)
    link(nt, rib.outputs[0], mix.inputs[0])
    link(nt, mix.outputs[2], bsdf.inputs["Base Color"])
    link(nt, rib.outputs[0], bsdf.inputs["Metallic"])
    bsdf.inputs["Roughness"].default_value = 0.22
    link(nt, bsdf.outputs[0], out.inputs[0])
DOME = mat("Dome", dome_build)

def glow_build(color, strength):
    def b(nt, out):
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs["Color"].default_value = color
        e.inputs["Strength"].default_value = strength
        link(nt, e.outputs[0], out.inputs[0])
    return b
WINDOW = mat("Window", glow_build((1.0, 0.40, 0.10, 1), 10))
LANTERN = mat("Lantern", glow_build((1.0, 0.45, 0.12, 1), 12))
SPARK = mat("Spark", glow_build((1.0, 0.75, 0.35, 1), 60))

def moon_build(nt, out):
    e = nt.nodes.new("ShaderNodeEmission")
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 3
    noise.inputs["Detail"].default_value = 8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (0.62, 0.58, 0.50, 1)
    ramp.color_ramp.elements[1].position = 0.65
    ramp.color_ramp.elements[1].color = (1.0, 0.95, 0.82, 1)
    link(nt, noise.outputs["Fac"], ramp.inputs["Fac"])
    link(nt, ramp.outputs["Color"], e.inputs["Color"])
    e.inputs["Strength"].default_value = 6
    link(nt, e.outputs[0], out.inputs[0])
MOON = mat("Moon", moon_build)

def sand_build(nt, out):
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.62, 0.42, 0.25, 1)
    bsdf.inputs["Roughness"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 1.6
    wave.inputs["Distortion"].default_value = 6
    wave.inputs["Detail"].default_value = 3
    link(nt, tc.outputs["Object"], wave.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.05
    link(nt, wave.outputs["Fac"], bump.inputs["Height"])
    link(nt, bump.outputs["Normal"], bsdf.inputs["Normal"])
    link(nt, bsdf.outputs[0], out.inputs[0])
SAND = mat("Sand", sand_build)

def carpet_build(nt, out):
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Sheen Weight"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    link(nt, tc.outputs["UV"], sep.inputs[0])
    # distance to edge -> border
    def edge(src):
        a = nt.nodes.new("ShaderNodeMath"); a.operation = "SUBTRACT"; a.inputs[1].default_value = 0.5
        link(nt, src, a.inputs[0])
        b = nt.nodes.new("ShaderNodeMath"); b.operation = "ABSOLUTE"
        link(nt, a.outputs[0], b.inputs[0])
        return b.outputs[0]
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
    link(nt, edge(sep.outputs["X"]), mx.inputs[0]); link(nt, edge(sep.outputs["Y"]), mx.inputs[1])
    border = nt.nodes.new("ShaderNodeMath"); border.operation = "GREATER_THAN"; border.inputs[1].default_value = 0.42
    link(nt, mx.outputs[0], border.inputs[0])
    # diamond pattern in middle
    pat = nt.nodes.new("ShaderNodeMath"); pat.operation = "MULTIPLY"; pat.inputs[1].default_value = 40
    link(nt, mx.outputs[0], pat.inputs[0])
    sn = nt.nodes.new("ShaderNodeMath"); sn.operation = "SINE"
    link(nt, pat.outputs[0], sn.inputs[0])
    pt = nt.nodes.new("ShaderNodeMath"); pt.operation = "GREATER_THAN"; pt.inputs[1].default_value = 0.6
    link(nt, sn.outputs[0], pt.inputs[0])
    m1 = nt.nodes.new("ShaderNodeMix"); m1.data_type = "RGBA"
    m1.inputs[6].default_value = (0.35, 0.02, 0.03, 1)
    m1.inputs[7].default_value = (0.05, 0.05, 0.25, 1)
    link(nt, pt.outputs[0], m1.inputs[0])
    m2 = nt.nodes.new("ShaderNodeMix"); m2.data_type = "RGBA"
    m2.inputs[7].default_value = (0.9, 0.6, 0.2, 1)
    link(nt, m1.outputs[2], m2.inputs[6])
    link(nt, border.outputs[0], m2.inputs[0])
    link(nt, m2.outputs[2], bsdf.inputs["Base Color"])
    link(nt, bsdf.outputs[0], out.inputs[0])
CARPET = mat("Carpet", carpet_build)

# ---------------------------------------------------------------- world: night sky + stars
world = bpy.data.worlds.new("Night"); scene.world = world
world.use_nodes = True
nt = world.node_tree; nt.nodes.clear()
wout = nt.nodes.new("ShaderNodeOutputWorld")
tc = nt.nodes.new("ShaderNodeTexCoord")
nrm = nt.nodes.new("ShaderNodeVectorMath"); nrm.operation = "NORMALIZE"; link(nt, tc.outputs["Generated"], nrm.inputs[0])
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); link(nt, nrm.outputs[0], sep.inputs[0])
grad = nt.nodes.new("ShaderNodeValToRGB")
cr = grad.color_ramp
cr.elements[0].position = 0.0;  cr.elements[0].color = (0.20, 0.06, 0.05, 1)   # warm horizon glow
cr.elements[1].position = 0.50; cr.elements[1].color = (0.0012, 0.0016, 0.008, 1)  # deep navy zenith
for p, c in [(0.04, (0.06, 0.022, 0.08, 1)), (0.12, (0.010, 0.012, 0.045, 1)), (0.25, (0.004, 0.005, 0.022, 1))]:
    cr.elements.new(p).color = c
link(nt, sep.outputs["Z"], grad.inputs["Fac"])
vor = nt.nodes.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = 260
vor.inputs["Randomness"].default_value = 1
link(nt, nrm.outputs[0], vor.inputs["Vector"])
star = nt.nodes.new("ShaderNodeMapRange")
star.inputs["From Min"].default_value = 0.0; star.inputs["From Max"].default_value = 0.06
star.inputs["To Min"].default_value = 1.0; star.inputs["To Max"].default_value = 0.0
link(nt, vor.outputs["Distance"], star.inputs["Value"])
pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 8
link(nt, star.outputs["Result"], pw.inputs[0])
# vary brightness, fade near horizon
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 60
link(nt, tc.outputs["Generated"], nz.inputs["Vector"])
m = nt.nodes.new("ShaderNodeMath"); m.operation = "MULTIPLY"
link(nt, pw.outputs[0], m.inputs[0]); link(nt, nz.outputs["Fac"], m.inputs[1])
hz = nt.nodes.new("ShaderNodeMapRange")
hz.inputs["From Min"].default_value = 0.03; hz.inputs["From Max"].default_value = 0.25
link(nt, sep.outputs["Z"], hz.inputs["Value"])
m2 = nt.nodes.new("ShaderNodeMath"); m2.operation = "MULTIPLY"
link(nt, m.outputs[0], m2.inputs[0]); link(nt, hz.outputs["Result"], m2.inputs[1])
m3 = nt.nodes.new("ShaderNodeMath"); m3.operation = "MULTIPLY"; m3.inputs[1].default_value = 40
link(nt, m2.outputs[0], m3.inputs[0])
add = nt.nodes.new("ShaderNodeMix"); add.data_type = "RGBA"; add.blend_type = "ADD"
add.inputs[0].default_value = 1
link(nt, grad.outputs["Color"], add.inputs[6])
sc = nt.nodes.new("ShaderNodeCombineXYZ")
for k in "XYZ": link(nt, m3.outputs[0], sc.inputs[k])
link(nt, sc.outputs[0], add.inputs[7])
bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = 1.0
link(nt, add.outputs[2], bg.inputs["Color"])
link(nt, bg.outputs[0], wout.inputs["Surface"])
# ---------------------------------------------------------------- moon + moonlight
bpy.ops.mesh.primitive_uv_sphere_add(radius=28, location=(-35, 420, 95), segments=64, ring_count=32)
moon = bpy.context.object; moon.name = "Moon"; moon.data.materials.append(MOON)
moon.visible_shadow = False
for p in moon.data.polygons: p.use_smooth = True

bpy.ops.object.light_add(type="SUN", location=(0, 0, 50))
sun = bpy.context.object; sun.data.energy = 0.6
sun.data.color = (0.45, 0.58, 1.0); sun.data.angle = math.radians(1.5)
d = (Vector((0, 0, 0)) - moon.location).normalized()
sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# warm rim light from below-left (city glow)
bpy.ops.object.light_add(type="AREA", location=(-30, 5, 4))
fill = bpy.context.object; fill.data.energy = 1500; fill.data.size = 20
fill.data.color = (1.0, 0.45, 0.2)
fill.rotation_euler = (math.radians(80), 0, math.radians(-60))

# ---------------------------------------------------------------- dunes
bpy.ops.mesh.primitive_grid_add(x_subdivisions=400, y_subdivisions=400, size=600, location=(0, 150, 0))
dunes = bpy.context.object; dunes.name = "Dunes"
tex = bpy.data.textures.new("DuneTex", "CLOUDS"); tex.noise_scale = 35; tex.noise_depth = 2
dm = dunes.modifiers.new("Displace", "DISPLACE"); dm.texture = tex; dm.strength = 9; dm.mid_level = 0.55
tex2 = bpy.data.textures.new("DuneTex2", "CLOUDS"); tex2.noise_scale = 9
dm2 = dunes.modifiers.new("Displace2", "DISPLACE"); dm2.texture = tex2; dm2.strength = 1.2
dunes.data.materials.append(SAND)
for p in dunes.data.polygons: p.use_smooth = True

# ---------------------------------------------------------------- palace
PX, PY = 8, 70
plat = box("Platform", (70, 40, 6), (PX, PY, 1.5), STONE)

def onion(name, R, loc, scale_h=1.0):
    prof = [(1.00, 0), (1.10, 0.25), (1.16, 0.50), (1.10, 0.80), (0.92, 1.05), (0.65, 1.30),
            (0.38, 1.52), (0.16, 1.70), (0.05, 1.85), (0.0, 1.95)]
    prof = [(r * R, z * R * scale_h) for r, z in prof]
    ob = lathe(name, prof, 64, loc, DOME)
    top = loc[2] + 1.95 * R * scale_h
    # finial
    lathe(name + "_fin", [(0.0, 0), (0.12 * R, 0.05 * R), (0.05 * R, 0.25 * R), (0.10 * R, 0.35 * R),
                          (0.03 * R, 0.45 * R), (0.0, 0.75 * R)], 24, (loc[0], loc[1], top), GOLD)
    return ob

def drum(name, R, h, loc, windows=12):
    lathe(name, [(0, 0), (R, 0), (R, h), (R * 1.04, h), (R * 1.04, h + 0.3), (0, h + 0.3)], 64, loc, STONE)
    for i in range(windows):
        a = 2 * math.pi * i / windows
        x = loc[0] + (R + 0.02) * math.cos(a); y = loc[1] + (R + 0.02) * math.sin(a)
        box(f"{name}_win{i}", (0.05, R * 0.18, h * 0.45), (x, y, loc[2] + h * 0.5), WINDOW, (0, 0, a))

def minaret(name, x, y, H, R):
    base = 4.5
    lathe(name, [(0, 0), (R * 1.2, 0), (R * 1.2, base), (R, base + 0.4), (R * 0.85, H),
                 (R * 1.5, H + 0.3), (R * 1.5, H + 0.7), (R * 0.75, H + 0.8), (R * 0.75, H + 4),
                 (R * 1.2, H + 4.2), (R * 1.2, H + 4.5), (R * 0.6, H + 4.6)], 32, (x, y, 0), STONE)
    lathe(name + "_ring", [(R * 1.52, H + 0.35), (R * 1.56, H + 0.5), (R * 1.52, H + 0.65)], 32, (x, y, 0), GOLD)
    for k in range(6):
        a = 2 * math.pi * k / 6
        box(f"{name}_w{k}", (0.04, R * 0.35, 1.6), (x + R * 0.77 * math.cos(a), y + R * 0.77 * math.sin(a), H + 2.3),
            WINDOW, (0, 0, a))
    onion(name + "_dome", R * 0.75, (x, y, H + 4.6), 1.15)

# central
drum("MainDrum", 9, 14, (PX, PY, 4.5), 16)
onion("MainDome", 9.6, (PX, PY, 18.8), 1.05)
# side wings
for sx in (-1, 1):
    wx = PX + sx * 21
    box(f"Wing{sx}", (16, 18, 10), (wx, PY, 9.5), STONE)
    for k in range(5):  # arched window row
        box(f"Wing{sx}_win{k}", (1.4, 0.1, 3.2), (wx - 6 + k * 3, PY - 9.05, 9), WINDOW)
    drum(f"SideDrum{sx}", 4.2, 3, (wx, PY, 14.5), 8)
    onion(f"SideDome{sx}", 4.5, (wx, PY, 17.8), 1.1)
# front gate
box("Gate", (14, 4, 16), (PX, PY - 13, 12.5), STONE)
box("GateArch", (5, 0.1, 9), (PX, PY - 15.05, 9.5), WINDOW)
# minarets
minaret("MinL", PX - 34, PY - 6, 30, 1.8)
minaret("MinR", PX + 34, PY - 6, 30, 1.8)
minaret("MinBL", PX - 26, PY + 14, 24, 1.5)
minaret("MinBR", PX + 26, PY + 14, 24, 1.5)

# window light spilling onto the sand / palace
for loc, en in [((PX, PY - 18, 6), 3000), ((PX - 21, PY - 13, 8), 1500), ((PX + 21, PY - 13, 8), 1500)]:
    bpy.ops.object.light_add(type="POINT", location=loc)
    L = bpy.context.object; L.data.energy = en; L.data.color = (1.0, 0.5, 0.15); L.data.shadow_soft_size = 2

# distant city silhouettes
for i in range(14):
    x = -150 + i * 22 + random.uniform(-6, 6)
    y = 170 + random.uniform(-20, 20)
    h = random.uniform(6, 16)
    box(f"City{i}", (random.uniform(6, 12), 6, h), (x, y, h / 2 + 1), STONE)
    if random.random() < 0.6:
        onion(f"CityDome{i}", random.uniform(2.5, 4), (x, y, h + 1), 1.1)
    for w in range(random.randint(1, 3)):
        box(f"CityWin{i}_{w}", (0.8, 0.05, 1.2),
            (x + random.uniform(-2, 2), y - 3.05, random.uniform(2, h)), WINDOW)

# ---------------------------------------------------------------- lanterns along the path
for i in range(8):
    for sx in (-1, 1):
        x = PX + sx * 9; y = PY - 22 - i * 8
        lathe(f"Post{i}{sx}", [(0, 0), (0.15, 0), (0.12, 3), (0, 3)], 12, (x, y, 0.5), STONE)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.35, location=(x, y, 3.8), segments=16, ring_count=8)
        l = bpy.context.object; l.data.materials.append(LANTERN)

# ---------------------------------------------------------------- flying carpet
bpy.ops.mesh.primitive_grid_add(x_subdivisions=60, y_subdivisions=36, size=1)
carpet = bpy.context.object; carpet.name = "Carpet"
carpet.scale = (5.5, 3.4, 1)
carpet.data.materials.append(CARPET)
sol = carpet.modifiers.new("Solid", "SOLIDIFY"); sol.thickness = 0.04
wv = carpet.modifiers.new("Wave", "WAVE")
wv.height = 0.18; wv.width = 1.4; wv.speed = 0.12; wv.use_y = False; wv.narrowness = 1.2
wv.time_offset = 0
for p in carpet.data.polygons: p.use_smooth = True

# carpet path: sweeps in from left, crosses the moon, banks toward palace
path = [
    (1,   (-55, 0, 17),  (0.10, 0.30, -0.45)),
    (80,  (-24, -6, 15), (0.05, 0.18, -0.25)),
    (160, (2, -8, 14),   (-0.04, -0.06, 0.10)),
    (240, (34, 4, 15),   (-0.06, -0.12, 0.40)),
]
for f, loc, rot in path:
    f = int(round(1 + (f - 1) * (N - 1) / 239))
    carpet.location = loc; carpet.rotation_euler = rot
    carpet.keyframe_insert("location", frame=f); carpet.keyframe_insert("rotation_euler", frame=f)
# gentle bob
fc = carpet.animation_data.action.fcurves if hasattr(carpet.animation_data.action, "fcurves") else None
for f in range(1, N + 1, 12):
    pass

# sparkle trail: small emissive motes keyed to follow the carpet with lag
motes = []
for i in range(40):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.03, 0.08), subdivisions=1)
    s = bpy.context.object; s.data.materials.append(SPARK); s.visible_shadow = False
    motes.append((s, random.uniform(4, 40), Vector((random.uniform(-2, 2), random.uniform(-1, 1), random.uniform(-1, 0.5)))))

def carpet_pos(f):
    scene.frame_set(max(1, min(N, int(f))))
    return carpet.matrix_world.translation.copy()

samples_cache = {}
for f in range(1, N + 1, 2):
    samples_cache[f] = carpet_pos(f)
def pos_at(f):
    f = max(1, min(N - 1, f))
    k = int(f) if int(f) % 2 == 1 else int(f) - 1
    k = max(1, k)
    return samples_cache.get(k, samples_cache[1])

for s, lag, off in motes:
    for f in range(1, N + 1, 6):
        p = pos_at(f - lag) + off + Vector((0, 0, -0.03 * lag))
        s.location = p
        s.keyframe_insert("location", frame=f)
        sc_ = max(0.0, 1 - lag / 45) * (0.7 + 0.3 * math.sin(f * 0.5 + lag))
        s.scale = (sc_, sc_, sc_)
        s.keyframe_insert("scale", frame=f)

# ---------------------------------------------------------------- camera
bpy.ops.object.camera_add()
cam = bpy.context.object; scene.camera = cam
cam.data.lens = 32
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 5.6
target = bpy.data.objects.new("CamTarget", None); scene.collection.objects.link(target)
tr = cam.constraints.new("TRACK_TO"); tr.target = target; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
cam.data.dof.focus_object = carpet
for f, cl, tl in [(1, (-14, -48, 6), (-20, 40, 22)),
                  (120, (-6, -42, 8), (-2, 40, 20)),
                  (240, (4, -34, 10), (14, 60, 18))]:
    cam.location = cl; target.location = tl
    cam.keyframe_insert("location", frame=f); target.keyframe_insert("location", frame=f)

# smooth all animation curves
for ob in bpy.data.objects:
    ad = ob.animation_data
    if ad and ad.action:
        try:
            curves = ad.action.fcurves
        except AttributeError:
            curves = [c for layer in ad.action.layers for st in layer.strips
                      for cb in st.channelbags for c in cb.fcurves]
        for c in curves:
            for kp in c.keyframe_points:
                kp.interpolation = "BEZIER"

# ---------------------------------------------------------------- render settings
r = scene.render
r.engine = "CYCLES"
scene.cycles.device = "CPU"
if args.gpu:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type != "CPU"]
            if gpus:
                for d in prefs.devices: d.use = True
                scene.cycles.device = "GPU"
                print("Rendering on GPU via", backend, [d.name for d in gpus])
                break
        except Exception:
            pass
    else:
        print("No supported GPU found - rendering on CPU")
scene.cycles.samples = args.samples
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.03
scene.cycles.use_denoising = True
scene.cycles.denoiser = "OPENIMAGEDENOISE"
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 2
scene.cycles.transmission_bounces = 2
scene.cycles.blur_glossy = 1.0
scene.cycles.sample_clamp_indirect = 5
r.resolution_x, r.resolution_y = 1920, 1080
r.resolution_percentage = args.res
r.use_motion_blur = True
r.motion_blur_shutter = 0.4
r.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.0
r.image_settings.file_format = "PNG"
r.use_persistent_data = True
r.filepath = args.out

# compositor glow
try:
    scene.use_nodes = True
    ct = scene.node_tree
    rl = ct.nodes.get("Render Layers") or ct.nodes.new("CompositorNodeRLayers")
    comp = ct.nodes.get("Composite") or ct.nodes.new("CompositorNodeComposite")
    glare = ct.nodes.new("CompositorNodeGlare")
    glare.glare_type = "FOG_GLOW"; glare.quality = "HIGH"
    try: glare.threshold = 1.0; glare.size = 8
    except Exception: pass
    ct.links.new(rl.outputs["Image"], glare.inputs["Image"])
    ct.links.new(glare.outputs["Image"], comp.inputs["Image"])
except Exception as ex:
    print("compositor skipped:", ex)

scene.frame_start, scene.frame_end = args.frames
if not globals().get("FILM"):
    bpy.ops.render.render(animation=True)
