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
}

let player;
let cursors;
let bullets;
let lastFired = 0;
let zombies;
let zombieSpawnTimer = 0;
let gameStartTime;
let difficulty = 1;

function create() {
    this.add.image(400, 300, 'background')
        .setOrigin(0.5, 0.5)
        .setDisplaySize(800, 600);
    
    player = this.physics.add.sprite(400, 300, 'player');
    player.setCollideWorldBounds(true);

    cursors = this.input.keyboard.createCursorKeys();

    bullets = this.physics.add.group({
        defaultKey: 'bullet',
        maxSize: 30,
        createCallback: (bullet) => {
            bullet.setRotation(Phaser.Math.DegToRad(-90));
            bullet.body.onWorldBounds = true;
        }
    });

    this.input.on('pointerdown', (pointer) => {
        if (this.time.now > lastFired) {
            const bullet = bullets.get(player.x, player.y);
            if (bullet) {
                bullet.setActive(true);
                bullet.setVisible(true);
                const angle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y);
                bullet.setRotation(angle + Phaser.Math.DegToRad(-90));
                this.physics.velocityFromRotation(angle, 500, bullet.body.velocity);
                lastFired = this.time.now + 100;
            }
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

    this.physics.add.collider(bullets, zombies, (bullet, zombie) => {
        bullet.setActive(false);
        bullet.setVisible(false);
        zombie.destroy();
    });

    this.physics.add.collider(player, zombies, (player, zombie) => {
        this.scene.restart();
    });

    this.physics.world.on('worldbounds', (body) => {
        const gameObject = body.gameObject;
        gameObject.setActive(false);
        gameObject.setVisible(false);
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
    
    const zombieSpeed = 100 + (difficulty * 20);
    this.physics.moveToObject(zombie, player, zombieSpeed);

    const shootingEvent = this.time.addEvent({
        delay: Phaser.Math.Between(2000 / difficulty, 4000 / difficulty),
        callback: () => {
            if (zombie.active && zombie.body) {
                const bullet = bullets.get(zombie.x, zombie.y);
                if (bullet) {
                    bullet.setActive(true);
                    bullet.setVisible(true);
                    bullet.body.enable = true;
                    
                    const angle = Phaser.Math.Angle.Between(zombie.x, zombie.y, player.x, player.y);
                    bullet.setRotation(angle + Phaser.Math.DegToRad(-90));
                    this.physics.velocityFromRotation(angle, 300, bullet.body.velocity);
                }
            } else {
                shootingEvent.destroy();
            }
        },
        callbackScope: this,
        loop: true
    });
}

function update() {
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
            if (bullet.x < 0 || bullet.x > 800 || bullet.y < 0 || bullet.y > 600) {
                bullet.setActive(false);
                bullet.setVisible(false);
            }
        }
    });

    zombies.getChildren().forEach((zombie) => {
        if (zombie.active) {
            this.physics.moveToObject(zombie, player, 100 + (difficulty * 20));
        }
    });
} 