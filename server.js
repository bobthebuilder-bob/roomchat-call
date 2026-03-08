const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

let activeRooms = {};
app.use(express.static(__dirname));

const htmlContent = `
<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>RoomChat Ultimate</title>
    <link rel="icon" href="/IMG_0856.jpeg" type="image/jpeg">
    <link rel="apple-touch-icon" href="/IMG-0856.jpeg">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,800;1,800&display=swap');
        :root { --bg: #05070f; --accent: #7c4dff; --card: #0d111d; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: var(--bg); color: white; margin: 0; overflow: hidden; }
        .logo-title { font-size: 42px; font-weight: 800; font-style: italic; text-transform: uppercase; background: linear-gradient(to bottom, #a78bfa, #7c4dff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .glass { background: var(--card); border: 1px solid rgba(255,255,255,0.05); border-radius: 30px; }
        .btn-primary { background: var(--accent); border-radius: 25px; color: white; font-weight: bold; }
        #video-container { position: fixed; inset: 0; background: #000; display: none; z-index: 100; padding: 10px; }
        .video-grid { display: grid; gap: 10px; width: 100%; height: calc(100% - 130px); grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); align-items: center; justify-items: center; }
        .video-wrapper { position: relative; width: 100%; height: 100%; max-width: 450px; aspect-ratio: 9 / 16; border-radius: 20px; overflow: hidden; background: #111; border: 1px solid rgba(255,255,255,0.1); }
        video { width: 100%; height: 100%; object-fit: cover !important; }
        .mirrored { transform: scaleX(-1); }
        #local-video-small { position: absolute; bottom: 120px; right: 15px; width: 85px; height: 130px; z-index: 160; border: 2px solid var(--accent); border-radius: 15px; object-fit: cover; }
        .controls { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 170; background: rgba(15, 23, 42, 0.85); padding: 14px; border-radius: 32px; border: 1px solid rgba(255,255,255,0.1); }
        .c-btn { width: 52px; height: 52px; border-radius: 18px; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: white; }
    </style>
</head>
<body>
    <div id="lobby" class="min-h-screen flex flex-col items-center p-6 pt-12">
        <h1 class="logo-title">ROOMCHAT</h1>
        <p class="text-[10px] tracking-[0.4em] font-bold text-slate-500 mb-8 uppercase">Universal Camera Edition</p>
        <div class="w-full max-w-md space-y-4">
            <button onclick="openCreateModal()" class="btn-primary w-full p-6 flex justify-between items-center">
                <span>SKAPA SAMTAL</span>
                <i data-lucide="plus"></i>
            </button>
            <div id="room-list" class="space-y-4 pt-4"></div>
        </div>
    </div>

    <div id="create-modal" class="hidden fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6">
        <div class="glass w-full max-w-sm p-8 text-center">
            <h2 class="text-xl font-bold uppercase mb-6 italic">Nytt Samtal</h2>
            <input id="room-name-in" type="text" placeholder="Rumsnamn..." class="w-full bg-black p-4 rounded-2xl mb-4 border border-white/10 text-white text-center">
            <div class="flex items-center justify-between mb-4 px-2">
                <span class="text-xs font-bold text-slate-400">KRÄV LÖSENORD</span>
                <input type="checkbox" id="pass-toggle" onchange="togglePassInput('room-pass-in')">
            </div>
            <input id="room-pass-in" type="password" placeholder="Lösenord..." class="hidden w-full bg-black p-4 rounded-2xl mb-6 border border-white/10 text-white text-center">
            <div class="flex gap-2">
                <button onclick="closeModals()" class="flex-1 p-4 text-slate-400">AVBRYT</button>
                <button onclick="createRoom()" class="flex-1 btn-primary p-4">STARTA</button>
            </div>
        </div>
    </div>

    <div id="video-container">
        <div id="grid" class="video-grid"></div>
        <video id="local-video-small" class="mirrored" autoplay playsinline muted></video>
        <div class="controls">
            <button class="c-btn" onclick="tM()"><i data-lucide="mic"></i></button>
            <button class="c-btn" onclick="tV()"><i data-lucide="video"></i></button>
            <button class="c-btn bg-red-600" onclick="location.reload()"><i data-lucide="phone-off"></i></button>
        </div>
    </div>

    <script>
        const socket = io();
        let localStream = null;
        let peers = {};

        function openCreateModal() { document.getElementById('create-modal').classList.remove('hidden'); }
        function closeModals() { document.getElementById('create-modal').classList.add('hidden'); }
        function togglePassInput(id) { document.getElementById(id).classList.toggle('hidden'); }

        function createRoom() {
            const name = document.getElementById('room-name-in').value.trim();
            if(!name) return;
            const id = Math.random().toString(36).substr(2, 6).toUpperCase();
            socket.emit('create-room', { id, name: name.toUpperCase(), password: null });
            closeModals();
            joinRoom(id);
        }

        socket.on('list-rooms', rooms => {
            const list = document.getElementById('room-list');
            list.innerHTML = '';
            for (let id in rooms) {
                const room = rooms[id];
                const item = document.createElement('div');
                item.className = 'glass p-6 flex justify-between items-center';
                item.innerHTML = '<div><div class="font-bold uppercase">' + room.name + '</div><div class="text-[10px] text-purple-400">' + room.users.length + '/5 DELTAGARE</div></div>';
                
                const btn = document.createElement('button');
                btn.className = 'btn-primary px-6 py-2 text-[10px]';
                btn.innerText = 'ANSLUT';
                btn.onclick = () => joinRoom(id);
                
                item.appendChild(btn);
                list.appendChild(item);
            }
            lucide.createIcons();
        });

        async function joinRoom(roomId) {
            console.log("Försöker ansluta till:", roomId);
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Webbläsaren stöder inte kamera eller så saknas HTTPS.");
                }

                document.getElementById('lobby').style.display = 'none';
                document.getElementById('video-container').style.display = 'block';

                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                document.getElementById('local-video-small').srcObject = localStream;
                socket.emit('join-room', roomId);
            } catch (err) {
                alert("FEL: " + err.message);
                location.reload();
            }
        }

        // WebRTC Logik
        socket.on('all-users', users => users.forEach(u => peers[u] = createPC(u, true)));
        socket.on('user-joined', d => peers[d.callerId] = createPC(d.callerId, false));

        function createPC(userId, isOffer) {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun1.l.google.com:19302' }] });
            localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
            pc.onicecandidate = e => e.candidate && socket.emit('signal', { to: userId, signal: { candidate: e.candidate } });
            pc.ontrack = e => {
                if(document.getElementById('wrap-'+userId)) return;
                const wrap = document.createElement('div');
                wrap.id = 'wrap-'+userId; wrap.className = 'video-wrapper';
                const v = document.createElement('video');
                v.srcObject = e.streams[0]; v.autoplay = true; v.playsInline = true;
                wrap.appendChild(v); document.getElementById('grid').appendChild(wrap);
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

        function tM() { const t = localStream.getAudioTracks()[0]; t.enabled = !t.enabled; }
        function tV() { const t = localStream.getVideoTracks()[0]; t.enabled = !t.enabled; }
        socket.on('user-left', id => { if(peers[id]) { peers[id].close(); delete peers[id]; } const w = document.getElementById('wrap-'+id); if(w) w.remove(); });
        window.onload = () => lucide.createIcons();
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

io.on('connection', (socket) => {
    socket.emit('list-rooms', activeRooms);
    socket.on('create-room', d => {
        activeRooms[d.id] = { name: d.name, users: [] };
        io.emit('list-rooms', activeRooms);
    });
    socket.on('join-room', rid => {
        if(!activeRooms[rid]) return;
        socket.emit('all-users', activeRooms[rid].users);
        activeRooms[rid].users.push(socket.id);
        socket.join(rid);
        socket.to(rid).emit('user-joined', { callerId: socket.id });
    });
    socket.on('signal', d => io.to(d.to).emit('signal', { from: socket.id, signal: d.signal }));
    socket.on('disconnect', () => {
        for (let rid in activeRooms) {
            activeRooms[rid].users = activeRooms[rid].users.filter(u => u !== socket.id);
            if (activeRooms[rid].users.length === 0) delete activeRooms[rid];
            io.emit('list-rooms', activeRooms);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => console.log('Server körs på port ' + PORT));