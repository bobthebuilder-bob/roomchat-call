const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Lagrar rum: { name, password, users: [] }
let activeRooms = {};

// Gör så att din uppladdade bild kan läsas av webbläsaren
app.use(express.static(__dirname));

const htmlContent = `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>RoomChat Ultimate</title>
    <link rel="icon" href="/IMG_0856.jpeg" type="image/jpeg">
    <link rel="apple-touch-icon" href="/IMG_0856.jpeg">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,800;1,800&display=swap');
        :root { --bg: #05070f; --accent: #7c4dff; --card: #0d111d; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: var(--bg); color: white; margin: 0; overflow: hidden; -webkit-tap-highlight-color: transparent; }
        .logo-title { font-size: 42px; font-weight: 800; font-style: italic; text-transform: uppercase; letter-spacing: -2px; background: linear-gradient(to bottom, #a78bfa, #7c4dff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .glass { background: var(--card); border: 1px solid rgba(255,255,255,0.05); border-radius: 30px; }
        .btn-primary { background: var(--accent); border-radius: 25px; transition: all 0.2s; color: white; font-weight: bold; }
        #video-container { position: fixed; inset: 0; background: #000; display: none; z-index: 100; padding: 10px; }
        .video-grid { display: grid; gap: 10px; width: 100%; height: calc(100% - 130px); grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); grid-auto-rows: 1fr; align-items: center; justify-items: center; }
        .video-wrapper { position: relative; width: 100%; height: 100%; max-width: 450px; aspect-ratio: 9 / 16; border-radius: 20px; overflow: hidden; background: #111; border: 1px solid rgba(255,255,255,0.1); }
        video { width: 100%; height: 100%; object-fit: cover !important; }
        .mirrored { transform: scaleX(-1); }
        #local-video-small { position: absolute; bottom: 120px; right: 15px; width: 85px; height: 130px; z-index: 160; border: 2px solid var(--accent); border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.8); object-fit: cover; background: #000; }
        .controls { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 170; background: rgba(15, 23, 42, 0.85); padding: 14px; border-radius: 32px; backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); width: fit-content; }
        .c-btn { width: 52px; height: 52px; border-radius: 18px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.05); color: white; }
        .c-btn.active { background: #ef4444; }
    </style>
</head>
<body>
    <div id="lobby" class="min-h-screen flex flex-col items-center p-6 pt-12 overflow-y-auto pb-24">
        <h1 class="logo-title">ROOMCHAT</h1>
        <p class="text-[10px] tracking-[0.4em] font-bold text-slate-500 mb-8 uppercase text-center text-white text-shadow">Universal Camera Edition</p>
        <div class="w-full max-w-md space-y-4">
            <button onclick="openCreateModal()" class="btn-primary w-full p-6 flex justify-between items-center shadow-2xl">
                <span>SKAPA SAMTAL</span>
                <i data-lucide="plus"></i>
            </button>
            <div id="room-list" class="space-y-4 pt-4 text-white"></div>
        </div>
    </div>

    <div id="create-modal" class="hidden fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6">
        <div class="glass w-full max-w-sm p-8 text-center text-white">
            <h2 class="text-xl font-bold uppercase mb-6 italic">Nytt Samtal</h2>
            <input id="room-name-in" type="text" placeholder="Rumsnamn..." class="w-full bg-black p-4 rounded-2xl mb-4 border border-white/10 outline-none font-bold text-white text-center">
            <div class="flex items-center justify-between mb-4 px-2">
                <span class="text-xs font-bold uppercase text-slate-400">Kräv lösenord</span>
                <input type="checkbox" id="pass-toggle" onchange="togglePassInput('room-pass-in')" class="w-5 h-5 accent-purple-600">
            </div>
            <input id="room-pass-in" type="password" placeholder="Lösenord..." class="hidden w-full bg-black p-4 rounded-2xl mb-6 border border-white/10 outline-none font-bold text-white text-center">
            <div class="flex gap-2">
                <button onclick="closeModals()" class="flex-1 p-4 text-[10px] font-bold text-slate-400">AVBRYT</button>
                <button onclick="createRoom()" class="flex-1 btn-primary p-4 text-[10px]">STARTA</button>
            </div>
        </div>
    </div>

    <div id="video-container">
        <div id="grid" class="video-grid"></div>
        <video id="local-video-small" class="mirrored" autoplay playsinline muted></video>
        <div class="controls">
            <button id="m-btn" class="c-btn" onclick="tM()"><i data-lucide="mic"></i></button>
            <button id="v-btn" class="c-btn" onclick="tV()"><i data-lucide="video"></i></button>
            <button id="flip-btn" class="c-btn" onclick="flipCam()"><i data-lucide="refresh-cw"></i></button>
            <button class="c-btn bg-red-600 border-none" onclick="location.reload()"><i data-lucide="phone-off"></i></button>
        </div>
    </div>

    <script>
        const socket = io();
        let localStream = null;
        let peers = {};
        let currentFacing = 'user';

        function openCreateModal() { document.getElementById('create-modal').classList.remove('hidden'); }
        function closeModals() { document.querySelectorAll('[id$="-modal"]').forEach(m => m.classList.add('hidden')); }

        function togglePassInput(id) {
            const input = document.getElementById(id);
            input.classList.toggle('hidden');
            if(!input.classList.contains('hidden')) input.focus();
        }

        function createRoom() {
            const name = document.getElementById('room-name-in').value.trim();
            const passEnabled = document.getElementById('pass-toggle').checked;
            const password = passEnabled ? document.getElementById('room-pass-in').value : null;
            if(!name) return;
            const id = Math.random().toString(36).substr(2, 6).toUpperCase();
            socket.emit('create-room', { id, name: name.toUpperCase(), password });
            closeModals();
            joinRoom(id);
        }

        socket.on('list-rooms', rooms => {
            const list = document.getElementById('room-list');
            list.innerHTML = '';
            Object.keys(rooms).forEach(id => {
                const isLocked = rooms[id].password !== null;
                list.innerHTML += \`
                    <div class="glass p-6 flex justify-between items-center">
                        <div>
                            <div class="font-black italic text-lg uppercase flex items-center gap-2">
                                \${rooms[id].name} \${isLocked ? '<i data-lucide="lock" class="w-3 h-3 text-slate-500"></i>' : ''}
                            </div>
                            <div class="text-[10px] text-purple-400 font-bold uppercase">● \${rooms[id].users.length}/5 Deltagare</div>
                        </div>
                        <button onclick="handleJoinClick('\${id}', '\${rooms[id].name}', \${isLocked})" class="btn-primary px-6 py-2 text-[10px]">ANSLUT</button>
                    </div>\`;
            });
            lucide.createIcons();
        });

        async function joinRoom(roomId) {
            document.getElementById('lobby').style.display = 'none';
            document.getElementById('video-container').style.display = 'block';
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, 
                    audio: true 
                });
                document.getElementById('local-video-small').srcObject = localStream;
                socket.emit('join-room', roomId);
            } catch (err) { alert("Kameraåtkomst krävs."); location.reload(); }
        }

        socket.on('all-users', users => users.forEach(u => peers[u] = createPC(u, true)));
        socket.on('user-joined', d => peers[d.callerId] = createPC(d.callerId, false));

        function createPC(userId, isOffer) {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }] });
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
            pc.onicecandidate = e => e.candidate && socket.emit('signal', { to: userId, signal: { candidate: e.candidate } });
            pc.ontrack = e => {
                if(document.getElementById('wrap-'+userId)) return;
                const wrap = document.createElement('div');
                wrap.id = 'wrap-'+userId;
                wrap.className = 'video-wrapper';
                const v = document.createElement('video');
                v.srcObject = e.streams[0];
                v.autoplay = true; v.playsInline = true;
                wrap.appendChild(v);
                document.getElementById('grid').appendChild(wrap);
            };
            if(isOffer) {
                pc.onnegotiationneeded = async () => {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('signal', { to: userId, signal: { sdp: pc.localDescription } });
                };
            }
            return pc;
        }

        socket.on('signal', async d => {
            if(!peers[d.from]) return;
            if(d.signal.sdp) {
                await peers[d.from].setRemoteDescription(new RTCSessionDescription(d.signal.sdp));
                if(d.signal.sdp.type === 'offer') {
                    const ans = await peers[d.from].createAnswer();
                    await peers[d.from].setLocalDescription(ans);
                    socket.emit('signal', { to: d.from, signal: { sdp: peers[d.from].localDescription } });
                }
            } else if(d.signal.candidate) {
                await peers[d.from].addIceCandidate(new RTCIceCandidate(d.signal.candidate));
            }
        });

        function tM() { const t = localStream.getAudioTracks()[0]; t.enabled = !t.enabled; document.getElementById('m-btn').classList.toggle('active', !t.enabled); }
        function tV() { const t = localStream.getVideoTracks()[0]; t.enabled = !t.enabled; document.getElementById('v-btn').classList.toggle('active', !t.enabled); }
        window.onload = () => lucide.createIcons();
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

io.on('connection', (socket) => {
    socket.emit('list-rooms', activeRooms);

    socket.on('create-room', d => {
        activeRooms[d.id] = { name: d.name, password: d.password, users: [] };
        io.emit('list-rooms', activeRooms);
    });

    socket.on('join-room', rid => {
        if(!activeRooms[rid] || activeRooms[rid].users.length >= 5) return;
        socket.emit('all-users', activeRooms[rid].users);
        activeRooms[rid].users.push(socket.id);
        socket.join(rid);
        socket.to(rid).emit('user-joined', { callerId: socket.id });
        io.emit('list-rooms', activeRooms);
    });

    socket.on('signal', d => io.to(d.to).emit('signal', { from: socket.id, signal: d.signal }));

    socket.on('disconnect', () => {
        for (const rid in activeRooms) {
            if (activeRooms[rid].users.includes(socket.id)) {
                activeRooms[rid].users = activeRooms[rid].users.filter(u => u !== socket.id);
                if (activeRooms[rid].users.length === 0) delete activeRooms[rid];
                io.emit('list-rooms', activeRooms);
            }
        }
    });
});

// Starta servern på alla tillgängliga adresser (0.0.0.0)
server.listen(PORT, '0.0.0.0', () => console.log('Server igång på port ' + PORT));