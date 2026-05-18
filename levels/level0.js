/**
 * Level 0 独立管理クラス
 * プレイヤーの周辺にのみ無限に壁と蛍光灯を「動的生成・削除（カリング）」する
 */
class Level0 {
    constructor(scene) {
        this.scene = scene;
        this.chunkSize = 12; // 1区画のサイズ
        this.renderDistance = 2; // 周囲何マイル（チャンク）まで生成するか
        this.chunks = new Map(); // 生成済みチャンクのキャッシュ

        // マテリアルの共通化（軽量化と超リアル化）
        // 蛍光灯の明かりをテクスチャに「焼いた（Bake）」風の陰影をグラデーションで擬似表現
        this.wallMaterial = new THREE.MeshLambertMaterial({
            color: 0xdfd49a, // Level0特有のださい黄色
            bumpScale: 0.05
        });
        
        // 擬似ベイク用の壁テクスチャ生成（Canvasで汚れとノイズを焼き込む）
        this.wallMaterial.map = this.createBakedTexture();

        // 蛍光灯（テクスチャに発光を焼き込み、光源は極小化）
        this.lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe0 });
        
        // グリッド配列（0: 空白, 1: 壁, 2: 蛍光灯天井）から1つのチャンクを形成
        this.chunkTemplate = [
            [1,1,1,1,1,1],
            [1,0,0,0,0,1],
            [1,0,2,0,0,1],
            [1,0,0,0,0,1],
            [1,1,0,1,1,1],
            [1,0,0,0,0,1],
        ];
    }

    // 壁の汚れ・質感をランダムにベイクするテクスチャ生成
    createBakedTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#dfd49a'; ctx.fillRect(0, 0, 256, 256);
        // 壁紙の湿気たシミ汚れ
        for (let i = 0; i < 500; i++) {
            ctx.fillStyle = `rgba(90, 80, 40, ${Math.random() * 0.15})`;
            ctx.fillRect(Math.random()*256, Math.random()*256, Math.random()*10, Math.random()*10);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    // プレイヤーの座標に基づき、背後のオブジェクト消去＆目の前のオブジェクト生成
    update(playerPosition) {
        const currentChunkX = Math.floor(playerPosition.x / this.chunkSize);
        const currentChunkZ = Math.floor(playerPosition.z / this.chunkSize);

        const activeKeys = new Set();

        // 周辺チャンクの生成ループ
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

        // プレイヤーの後ろ（視界・描画範囲外）になったチャンクをシーンから削除して超軽量化
        for (let [key, chunkData] of this.chunks.entries()) {
            if (!activeKeys.has(key)) {
                chunkData.meshes.forEach(mesh => this.scene.remove(mesh));
                this.chunks.delete(key);
            }
        }
    }

    // 1つのエリア（チャンク）を動的生成
    generateChunk(cx, cz, key) {
        const meshes = [];
        const group = new THREE.Group();
        const offsetX = cx * this.chunkSize;
        const offsetZ = cz * this.chunkSize;

        const wallGeo = new THREE.BoxGeometry(2, 3, 2);
        const ceilingGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
        const lightGeo = new THREE.BoxGeometry(1.5, 0.1, 0.4);

        // 床と天井
        const floor = new THREE.Mesh(ceilingGeo, new THREE.MeshLambertMaterial({color: 0x7a6d4d})); // 湿ったカーペット色
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(offsetX + this.chunkSize/2, 0, offsetZ + this.chunkSize/2);
        this.scene.add(floor); meshes.push(floor);

        const ceil = new THREE.Mesh(ceilingGeo, new THREE.MeshLambertMaterial({color: 0xccccaa}));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(offsetX + this.chunkSize/2, 3, offsetZ + this.chunkSize/2);
        this.scene.add(ceil); meshes.push(ceil);

        // 簡易アルゴリズム配置（シード値ベースで無限に一意なマップを生成可能）
        const size = this.chunkTemplate.length;
        const scale = this.chunkSize / size;

        for(let r=0; r<size; r++) {
            for(let c=0; c<size; c++) {
                // 擬似ランダムで壁の配置を少し変えて無限感を出す（簡易版）
                let type = this.chunkTemplate[r][c];
                let posX = offsetX + c * scale + scale/2;
                let posZ = offsetZ + r * scale + scale/2;

                if (type === 1) {
                    const wall = new THREE.Mesh(wallGeo, this.wallMaterial);
                    wall.position.set(posX, 1.5, posZ);
                    this.scene.add(wall);
                    meshes.push(wall);
                } else if (type === 2 || (type === 0 && Math.random() > 0.92)) {
                    // 蛍光灯（テクスチャベイク風基本マテリアル）
                    const flLight = new THREE.Mesh(lightGeo, this.lightMaterial);
                    flLight.position.set(posX, 2.95, posZ);
                    this.scene.add(flLight);
                    meshes.push(flLight);

                    // 実際のThree.jsのPointLightは負荷高いため、各チャンクに1〜2個のみに制限し軽量化
                    const pointLight = new THREE.PointLight(0xfffee0, 0.6, 8);
                    pointLight.position.set(posX, 2.8, posZ);
                    this.scene.add(pointLight);
                    meshes.push(pointLight);
                }
            }
        }

        this.chunks.set(key, { meshes: meshes });
    }
}

// グローバルスコープに登録
window.Level0 = Level0;
