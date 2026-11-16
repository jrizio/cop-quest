extends Node
## Sound effects + music (autoload "Sound"). Clips are synthesized by
## tools/gen_audio.js into assets/audio/.

var _music: AudioStreamPlayer
var _sfx: Array[AudioStreamPlayer] = []
var _cache := {}
var music_volume_db := -6.0
var muted := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_music = AudioStreamPlayer.new()
	add_child(_music)
	for i in 4:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_sfx.append(p)


func _stream(clip: String) -> AudioStream:
	if not _cache.has(clip):
		var path := "res://assets/audio/%s.wav" % clip
		_cache[clip] = load(path) if ResourceLoader.exists(path) else null
	return _cache[clip]


func play(clip: String) -> void:
	if muted:
		return
	var s := _stream(clip)
	if s == null:
		return
	for p in _sfx:
		if not p.playing:
			p.stream = s
			p.play()
			return
	_sfx[0].stream = s
	_sfx[0].play()


func music(clip: String) -> void:
	var s := _stream(clip)
	if s == null or (_music.playing and _music.stream == s):
		return
	if s is AudioStreamWAV:
		var w := s as AudioStreamWAV
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_begin = 0
		w.loop_end = int(w.get_length() * w.mix_rate)
	_music.stream = s
	_music.volume_db = -80.0 if muted else music_volume_db
	_music.play()


func stop_music() -> void:
	_music.stop()


func toggle_mute() -> void:
	muted = not muted
	_music.volume_db = -80.0 if muted else music_volume_db
