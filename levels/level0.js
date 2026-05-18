/**
 * Level 0 管理クラス（真っ暗対策 ＆ 高互換性調整版）
 */
class Level0 {
    constructor(scene) {
        this.scene = scene;
        this.chunkSize = 12; 
        this.renderDistance = 2; 
        this.chunks = new Map(); 

        // 【真っ暗対策】MeshLambert から MeshStandardMaterial に変更
        this.wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xdfd49a, 
            roughness: 0.8,
            metalness: 0.05,
            // 完全に光が当たらなくてもうっすら壁が見えるように自己発光を設定
            emissive: new THREE.Color(0xdfd49a),
            emissiveIntensity: 0.08 
        });
        
        this.wallMaterial.map = this.createBakedTexture();

        // 蛍光灯自体のマテリアル（白く光って見えるように）
        this.lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        this.chunkTemplate = [
            [1,1,1,1,1,1],
            [1,0,0,0,0,1],
            [1,0,2,0,0,1],
            [1,0,0,0,0,1],
            [1,1,0,1,1,1],
            [1,0,0,0,0,1],
        ];
    }

    createBakedTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#dfd49a'; ctx.fillRect(0, 0, 256, 256);
        
        // シミやノイズの焼き込み
        for (let i = 0; i < 300; i++) {
            ctx.fillStyle = `rgba(90, 80, 40, ${Math.random() * 0.12})`;
            ctx.fillRect(Math.random()*256, Math.random()*256, Math.random()*8, Math.random()*8);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    update(playerPosition) {
        const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);
        const activeKeys = new Set();

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const chunkX = currentChunkX + x;
                const chunkZ = currentChunkZ + z;
                const chunkKey = `${chunkX},${chunkZ}`;
                activeKeys.add(chunkKey);

                if (!this.chunks.has(chunkKey)) {
                    this.generateChunk(chunkX, chunkZ, chunkKey);
                }
            }
        }

        for (let [key, chunkData] of this.chunks.entries()) {
            if (!activeKeys.has(key)) {
                chunkData.meshes.forEach(mesh => this.scene.remove(mesh));
                this.chunks.delete(key);
            }
        }
    }

    generateChunk(cx, cz, key) {
        const meshes = [];
        const offsetX = cx * this.chunkSize;
        const offsetZ = cz * this.chunkSize;

        const wallGeo = new THREE.BoxGeometry(2, 3, 2);
        const ceilingGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
        const lightGeo = new THREE.BoxGeometry(1.6, 0.05, 0.5);

        // 床（カーペット）と天井
        const floor = new THREE.Mesh(ceilingGeo, new THREE.MeshStandardMaterial({color: 0x7a6d4d, roughness: 0.9}));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(offsetX + this.chunkSize/2, 0, offsetZ + this.chunkSize/2);
        this.scene.add(floor); meshes.push(floor);

        const ceil = new THREE.Mesh(ceilingGeo, new THREE.MeshStandardMaterial({color: 0xccccaa, roughness: 0.7}));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(offsetX + this.chunkSize/2, 3, offsetZ + this.chunkSize/2);
        this.scene.add(ceil); meshes.push(ceil);

        const size = this.chunkTemplate.length;
        const scale = this.chunkSize / size;

        for(let r=0; r<size; r++) {
            for(let c=0; c<size; c++) {
                let type = this.chunkTemplate[r][c];
                let posX = offsetX + c * scale + scale/2;
                let posZ = offsetZ + r * scale + scale/2;

                if (type === 1) {
                    const wall = new THREE.Mesh(wallGeo, this.wallMaterial);
                    wall.position.set(posX, 1.5, posZ);
                    this.scene.add(wall);
                    meshes.push(wall);
                } else if (type === 2 || (type === 0 && Math.random() > 0.93)) {
                    // 蛍光灯モデル
                    const flLight = new THREE.Mesh(lightGeo, this.lightMaterial);
                    flLight.position.set(posX, 2.97, posZ);
                    this.scene.add(flLight);
                    meshes.push(flLight);

                    // 【真っ暗対策】蛍光灯からの光の強さと範囲を大幅に強化
                    const pointLight = new THREE.PointLight(0xfffdd0, 1.8, 14);
                    pointLight.decay = 1.5; // 自然な光の減衰
                    pointLight.position.set(posX, 2.7, posZ);
                    this.scene.add(pointLight);
                    meshes.push(pointLight);
                }
            }
        }

        this.chunks.set(key, { meshes: meshes });
    }
}

window.Level0 = Level0;
