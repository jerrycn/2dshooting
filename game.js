const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('player', 'assets/player.png');
    this.load.image('bullet', 'assets/bullet.png');
    this.load.image('zombie', 'assets/zombie.png');
    this.load.image('background', 'assets/background.png');
    this.load.image('handgun', 'assets/handgun.png');
    this.load.image('machine', 'assets/machine.png');
    this.load.image('egggun', 'assets/egggun.png');
}

let player;
let cursors;
let bullets;
let lastFired = 0;
let zombies;
let zombieSpawnTimer = 0;
let gameStartTime;
let difficulty = 1;
let glow;
let gameOver = false;
let score = 0;
let scoreText;
let weaponText;
let currentWeapon = 'handgun';
let weaponDropTime = 0;
let weaponDropSprite = null;
let lastWeaponType = 'machine';
let burstCount = 0;
let burstTimer = null;

function create() {
    this.add.image(400, 300, 'background')
        .setOrigin(0.5, 0.5)
        .setDisplaySize(800, 600);
    
    glow = this.add.circle(400, 300, 40, 0x0088ff, 0.2);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);
    
    const bodySize = 24;
    player.body.setCircle(bodySize / 2);
    player.body.setOffset(
        (player.width - bodySize) / 2,
        (player.height - bodySize) / 2
    );

    cursors = this.input.keyboard.createCursorKeys();

    bullets = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Sprite,
        defaultKey: 'bullet',
        maxSize: 30,
        createCallback: (bullet) => {
            bullet.setScale(0.5);
            bullet.body.setSize(4, 4);
            bullet.body.allowGravity = false;
        }
    });

    this.input.on('pointerdown', (pointer) => {
        if (this.time.now > lastFired) {
            if (currentWeapon === 'machine') {
                startBurst.call(this, pointer);
            } else {
                shootBullet.call(this, player, pointer, false);
            }
            lastFired = this.time.now + (currentWeapon === 'machine' ? 50 : 200);
        }
    });

    zombies = this.physics.add.group();
    gameStartTime = this.time.now;

    this.time.addEvent({
        delay: 500,
        callback: checkZombieSpawn,
        callbackScope: this,
        loop: true
    });

    scoreText = this.add.text(16, 16, '分数: 0', {
        fontSize: '32px',
        fill: '#fff',
        fontFamily: 'Arial',
        stroke: '#000',
        strokeThickness: 4
    });

    this.physics.add.overlap(bullets, zombies, (bullet, zombie) => {
        if (!bullet.zombieBullet) {
            bullet.destroy();
            zombie.destroy();
            score += 1;
            scoreText.setText('分数: ' + score);
        }
    });

    this.physics.add.overlap(bullets, player, (player, bullet) => {
        if (bullet.zombieBullet) {
            bullet.destroy();
            gameOverHandler.call(this);
        }
    });

    this.physics.world.removeListener('worldbounds');

    this.physics.add.group({
        createCallback: (zombie) => {
            zombie.body.setCircle(bodySize / 2);
            zombie.body.setOffset(
                (zombie.width - bodySize) / 2,
                (zombie.height - bodySize) / 2
            );
        }
    });

    weaponText = this.add.text(game.config.width - 16, 16, '武器: 手枪', {
        fontSize: '32px',
        fill: '#fff',
        fontFamily: 'Arial',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(1, 0);

    this.time.addEvent({
        delay: 20000,
        callback: dropWeapon,
        callbackScope: this,
        loop: true
    });
}

function checkZombieSpawn() {
    const timePassed = (this.time.now - gameStartTime) / 1000;
    difficulty = 1 + Math.floor(timePassed / 30) * 0.5;

    if (Math.random() < 0.2 * difficulty) {
        spawnZombie.call(this);
    }
}

function spawnZombie() {
    let x, y;
    const side = Math.floor(Math.random() * 4);

    switch(side) {
        case 0:
            x = Math.random() * 800;
            y = 0;
            break;
        case 1:
            x = 800;
            y = Math.random() * 600;
            break;
        case 2:
            x = Math.random() * 800;
            y = 600;
            break;
        case 3:
            x = 0;
            y = Math.random() * 600;
            break;
    }

    const zombie = zombies.create(x, y, 'zombie');
    zombie.setCollideWorldBounds(true);
    
    const bodySize = 24;
    zombie.body.setCircle(bodySize / 2);
    zombie.body.setOffset(
        (zombie.width - bodySize) / 2,
        (zombie.height - bodySize) / 2
    );
    
    const zombieSpeed = 100 + (difficulty * 20);
    this.physics.moveToObject(zombie, player, zombieSpeed);

    const shootingEvent = this.time.addEvent({
        delay: Phaser.Math.Between(2000 / difficulty, 4000 / difficulty),
        callback: () => {
            if (zombie.active && zombie.body) {
                shootBullet.call(this, zombie, player, true);
            } else {
                shootingEvent.destroy();
            }
        },
        callbackScope: this,
        loop: true
    });
}

function dropWeapon() {
    if (weaponDropSprite) {
        weaponDropSprite.destroy();
    }

    const x = Phaser.Math.Between(100, game.config.width - 100);
    const y = Phaser.Math.Between(100, game.config.height - 100);
    
    lastWeaponType = lastWeaponType === 'machine' ? 'egggun' : 'machine';
    weaponDropSprite = this.physics.add.sprite(x, y, lastWeaponType);
    weaponDropSprite.setScale(0.5);
    weaponDropSprite.weaponType = lastWeaponType;

    const weaponGlow = this.add.circle(x, y, 30, 0xffff00, 0.3);
    weaponGlow.setBlendMode(Phaser.BlendModes.ADD);
    
    weaponDropSprite.glowEffect = weaponGlow;

    this.tweens.add({
        targets: [weaponDropSprite, weaponGlow],
        y: y + 10,
        duration: 1000,
        yoyo: true,
        repeat: -1
    });

    this.physics.add.overlap(player, weaponDropSprite, collectWeapon, null, this);
}

function collectWeapon(player, weapon) {
    if (burstTimer) {
        burstTimer.destroy();
        burstTimer = null;
    }
    
    currentWeapon = weapon.weaponType;
    weaponText.setText('武器: ' + (currentWeapon === 'machine' ? '机枪' : '散弹枪'));
    
    if (weapon.glowEffect) {
        weapon.glowEffect.destroy();
    }
    weapon.destroy();
    
    this.time.delayedCall(10000, () => {
        currentWeapon = 'handgun';
        weaponText.setText('武器: 手枪');
    });
}

function gameOverHandler() {
    if (!gameOver) {
        if (burstTimer) {
            burstTimer.destroy();
            burstTimer = null;
        }
        
        gameOver = true;
        this.physics.pause();
        
        const overlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.7);
        
        this.add.text(400, 200, '最终分数: ' + score, {
            fontSize: '48px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        
        const gameOverText = this.add.text(400, 280, '游戏结束', {
            fontSize: '64px',
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        
        const restartButton = this.add.text(400, 380, '点击重新开始', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: 'Arial'
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            gameOver = false;
            score = 0;
            currentWeapon = 'handgun';
            if (weaponDropSprite) {
                weaponDropSprite.destroy();
            }
            this.scene.restart();
        });
        
        restartButton.on('pointerover', () => {
            restartButton.setStyle({ fill: '#ff0' });
        });
        
        restartButton.on('pointerout', () => {
            restartButton.setStyle({ fill: '#fff' });
        });
    }
}

function update() {
    if (gameOver) return;
    
    player.setVelocity(0);

    if (cursors.left.isDown) {
        player.setVelocityX(-200);
    } else if (cursors.right.isDown) {
        player.setVelocityX(200);
    }

    if (cursors.up.isDown) {
        player.setVelocityY(-200);
    } else if (cursors.down.isDown) {
        player.setVelocityY(200);
    }

    bullets.getChildren().forEach((bullet) => {
        if (bullet.active) {
            const bounds = 50;
            if (bullet.x < -bounds || 
                bullet.x > game.config.width + bounds || 
                bullet.y < -bounds || 
                bullet.y > game.config.height + bounds) {
                bullet.destroy();
            }
        }
    });

    zombies.getChildren().forEach((zombie) => {
        if (zombie.active) {
            this.physics.moveToObject(zombie, player, 100 + (difficulty * 20));
        }
    });

    glow.setPosition(player.x, player.y);
    
    const glowSize = 40 + Math.sin(this.time.now / 500) * 5;
    glow.setRadius(glowSize);
}

function shootBullet(shooter, target, isZombie) {
    if (isZombie || currentWeapon !== 'egggun') {
        const bullet = bullets.get(shooter.x, shooter.y);
        if (bullet) {
            setupBullet(this, bullet, shooter, target, isZombie);
        }
    } else {
        const spreadAngle = Math.PI / 6;
        for (let i = -2; i <= 2; i++) {
            const bullet = bullets.get(shooter.x, shooter.y);
            if (bullet) {
                const angleOffset = (i * spreadAngle) / 2;
                setupBullet(this, bullet, shooter, target, isZombie, angleOffset);
            }
        }
    }
}

function setupBullet(scene, bullet, shooter, target, isZombie, angleOffset = 0) {
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.zombieBullet = isZombie;

    if (!isZombie) {
        if (currentWeapon === 'machine') {
            bullet.setScale(1);
            bullet.body.setSize(8, 8);
        } else if (currentWeapon === 'egggun') {
            bullet.setScale(0.7);
            bullet.body.setSize(6, 6);
        } else {
            bullet.setScale(0.5);
            bullet.body.setSize(4, 4);
        }
    }

    let targetX = target.x;
    let targetY = target.y;
    if (target instanceof Phaser.Input.Pointer) {
        targetX = target.x;
        targetY = target.y;
    }

    let angle = Phaser.Math.Angle.Between(
        shooter.x, shooter.y,
        targetX, targetY
    );
    
    angle += angleOffset;

    let speed;
    if (isZombie) {
        speed = 300;
    } else if (currentWeapon === 'machine') {
        speed = 900;
    } else if (currentWeapon === 'egggun') {
        speed = 700;
    } else {
        speed = 500;
    }

    bullet.setRotation(angle);
    bullet.body.reset(shooter.x, shooter.y);
    scene.physics.velocityFromRotation(angle, speed, bullet.body.velocity);

    const bulletLifetime = currentWeapon === 'handgun' ? 3000 : 2000;
    scene.time.delayedCall(bulletLifetime, () => {
        if (bullet.active) {
            bullet.destroy();
        }
    });
}

function startBurst(pointer) {
    burstCount = 0;
    const totalBursts = Phaser.Math.Between(3, 5);
    
    const fireBurst = () => {
        if (burstCount < totalBursts) {
            shootBullet.call(this, player, pointer, false);
            burstCount++;
            
            burstTimer = this.time.delayedCall(100, fireBurst);
        }
    };
    
    fireBurst();
} 