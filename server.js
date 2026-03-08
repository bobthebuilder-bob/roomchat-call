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
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="/socket.io/socket.io.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap');
        :root { --bg: #05070f; --accent: #7c4dff; --card: #111420; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: var(--bg); color: white; margin: 0; overflow: hidden; }
        .logo-title { font-size: 42px; font-weight: 800; font-style: italic; text-transform: uppercase; background: linear-gradient(to bottom, #a78bfa, #7c4dff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .glass { background: var(--card); border: 1px solid rgba(255,255,255,0.05); border-radius: 30px; }
        .btn-primary { background: var(--accent); border-radius: 25px; color: white; font-weight: bold; }
        
        #video-container { position: fixed; inset: 0; background: #000; display: none; z-index: 100; padding: 10px; }
        .video-grid { display: grid; gap: 10px; width: 100%; height: calc(100% - 130px); grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); align-items: center; justify-items: center; }
        .video-wrapper { position: relative; width: 100%; height: 100%; max-width: 450px; aspect-ratio: 9 / 16; border-radius: 24px; overflow: hidden; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.1); }
        video { width: 100%; height: 100%; object-fit: cover !important; }
        .mirrored { transform: scaleX(-1); }
        
        #local-video-small { position: absolute; bottom: 115px; right: 15px; width: 85px; height: 135px; z-index: 160; border: 2px solid var(--accent); border-radius: 18px; object-fit: cover; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
        
        .controls { position: fixed; bottom: 25px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; z-index: 170; background: rgba(15, 23, 42, 0.95); padding: 16px; border-radius: 35px; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(15px); }
        .c-btn { width: 54px; height: 54px; border-radius: 20px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: white; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        .c-btn:active { transform: scale(0.9); }
        .c-btn.btn-off { background: #ef4444 !important; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }
    </style>
</head>
<body>
    <div id="lobby" class="min-h-screen flex flex-col items-center p-6 pt-12">
        <h1 class="logo-title">ROOMCHAT</h1>
        <p class="text-[10px] tracking-[0.4em] font-bold text-slate-500 mb-8 uppercase">Universal Camera Edition</p>
        <div class="w-full max-w-md space-y-4">
            <button onclick="openCreateModal()" class="btn-primary w-full p-6 flex justify-between items-center shadow-2xl">
                <span>SKAPA SAMTAL</span>
                <i data-lucide="plus"></i>
            </button>
            <div id="room-list" class="space-y-4 pt-4"></div>
        </div>
    </div>

    <div id="create-modal" class="hidden fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
        <div class="glass w-full max-w-sm p-8 text-center border-white/10">
            <h2 class="text-xl font-bold uppercase mb-6 italic tracking-widest text-purple-400">Nytt Samtal</h2>
            <input id="room-name-in" type="text" placeholder="Rumsnamn..." class="w-full bg-black/50 p-4 rounded-2xl mb-6 border border-white/10 text-white text-center font-bold focus:border-purple-500 outline-none">
            <div class="flex gap-3">
                <button onclick="closeModals()" class="flex-1 p-4 text-slate-400 font-bold hover:text-white transition-colors">AVBRYT</button>
                <button onclick="createRoom()" class="flex-1 btn-primary p-4 shadow-lg shadow-purple-500/20">STARTA</button>
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
        function closeModals() { document.getElementById('create-modal').classList.add('hidden'); }

        function createRoom() {
            const name = document.getElementById('room-name-in').value.trim();
            if(!name) return;
            const id = Math.random().toString(36).substr(2, 6).toUpperCase();
            socket.emit('create-room', { id, name: name.toUpperCase() });
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
                item.innerHTML = '<div><div class="font-bold uppercase tracking-tight">' + room.name + '</div><div class="text-[10px] font-bold text-purple-400 mt-1">' + room.users.length + '/5 DELTAGARE</div></div>';
                const btn = document.createElement('button');
                btn.className = 'btn-primary px-6 py-2 text-[10px] tracking-widest';
                btn.innerText = 'ANSLUT';
                btn.onclick = () => joinRoom(id);
                item.appendChild(btn);
                list.appendChild(item);
            }
            lucide.createIcons();
        });

        async function joinRoom(roomId) {
            try {
                document.getElementById('lobby').style.display = 'none';
                document.getElementById('video-container').style.display = 'block';

                localStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: currentFacing }, 
                    audio: true 
                });
                document.getElementById('local-video-small').srcObject = localStream;
                socket.emit('join-room', roomId);
            } catch (err) {
                alert("Kamerafel: " + err.message);
                location.reload();
            }
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
                v.autoplay = true;
                v.playsInline = true;
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

        function tM() {
            const track = localStream.getAudioTracks()[0];
            track.enabled = !track.enabled;
            document.getElementById('m-btn').classList.toggle('btn-off', !track.enabled);
        }

        function tV() {
            const track = localStream.getVideoTracks()[0];
            track.enabled = !track.enabled;
            document.getElementById('v-btn').classList.toggle('btn-off', !track.enabled);
        }

        async function flipCam() {
            if (!localStream) return;
            currentFacing = currentFacing === 'user' ? 'environment' : 'user';
            
            const newStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: currentFacing }, 
                audio: true 
            });
            
            const videoTrack = newStream.getVideoTracks()[0];
            for (let id in peers) {
                const sender = peers[id].getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack);
            }
            
            localStream.getVideoTracks()[0].stop();
            localStream = newStream;
            const localVid = document.getElementById('local-video-small');
            localVid.srcObject = newStream;
            localVid.classList.toggle('mirrored', currentFacing === 'user');
        }

        socket.on('user-left', id => {
            if(peers[id]) {
                peers[id].close();
                delete peers[id];
            }
            const el = document.getElementById('wrap-'+id);
            if(el) el.remove();
        });

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
        if (!activeRooms[rid].users.includes(socket.id)) {
            activeRooms[rid].users.push(socket.id);
        }
        socket.join(rid);
        socket.to(rid).emit('user-joined', { callerId: socket.id });
        io.emit('list-rooms', activeRooms); // Uppdaterar rumslistan för alla så det står 1/5, 2/5 etc.
    });

    socket.on('signal', d => io.to(d.to).emit('signal', { from: socket.id, signal: d.signal }));

    socket.on('disconnect', () => {
        for (let rid in activeRooms) {
            if (activeRooms[rid].users.includes(socket.id)) {
                activeRooms[rid].users = activeRooms[rid].users.filter(u => u !== socket.id);
                socket.to(rid).emit('user-left', socket.id);
                if (activeRooms[rid].users.length === 0) {
                    delete activeRooms[rid];
                }
                io.emit('list-rooms', activeRooms);
            }
        }
    });
});

server.listen(PORT, '0.0.0.0', () => console.log('RoomChat är igång på port ' + PORT));