import sound from './sound';
import Vec2 from './physics/Vec2';
import Point from './physics/Point';
import Rope from './physics/Rope';
import Square from './physics/Square';
import PointConstraint from './physics/PointConstraint';
import {random, int, range, rangeInt} from './random';

const aim = new Image();
aim.src = 'aim.png';
const texture = new Image();
const sounds = [
  sound('7BMHBGGaSzarJeS7MiiRhykUpKV4wWpEZpdYH6pVwK37AGbh35bGS4Kq3LtjMFVd39pHRstQSpE3yrKF9C9e5qHfo5y753MhNFdGb8dMPboFMHdoAh23ywBAX'),
  sound('12TTcYkj3oge3fiLF85vp5Wk6eVCSUs42gWSdefSWWJqa1juWJbyMbMJFVS4Mo546WdpoSAVAc8Qf8S3L8baXW13MTA8ojab2F4c1TsRUT29GFxaDLRYtNn3cH'),
  sound('11111HH1xzWQ2n9NjPoeata2U7iAjRb4HNmh3T61D1hPrHyvEZ4AmJwMLG8p7eMPMyEgQby4atBXLYT1BSQ8JWC6sU8tzXLhiJdp2mz9pZPhmfzNKn9Kp4Ss')
]
const levels = [
  [], // there is no level 0
];

const numberOfLevels = 10;
function generateLevel(i) {
  const percentComplete = i/numberOfLevels;
  return [
    Math.max(4*percentComplete,1), // LEVEL_GENERATION_SPEED
    25 + (80*percentComplete), // LEVEL_LENGTH
    4, // LEVEL_GUN_TEXTURE
    5, // LEVEL_AMMO_TEXTURE
    Math.max(4*percentComplete,1)|0, // LEVEL_AMMO_COUNT
    10 + (20*percentComplete), // LEVEL_AMMO_RATE
    rangeInt(0,5), // LEVEL_AMMO_HIT_COLOR
    Math.max(100*percentComplete,10)|0, // LEVEL_AMMO_HIT_COUNT
    3,  // LEVEL_AMMO_HIT_SIZE
    rangeInt(3,8), // LEVEL_BACKGROUND_PARTS
    makeColors(
      0.2,0.1,0.1,rangeInt(0,100),rangeInt(0,100),rangeInt(0,100)
    )
  ]
}

for (let i=0;i<numberOfLevels;i++) {
  levels.push(generateLevel(i));
}

let canvas = document.getElementById('game'),
  width = window.innerWidth,
  height = window.innerHeight,
  context = canvas.getContext('2d');

canvas.width = width;
canvas.height = height;
window.width = width;
window.height = height;

const LEVEL_GENERATION_SPEED = 0;
const LEVEL_LENGTH = 1;
const LEVEL_GUN_TEXTURE = 2;
const LEVEL_AMMO_TEXTURE = 3;
const LEVEL_AMMO_COUNT = 4;
const LEVEL_AMMO_RATE = 5;
const LEVEL_AMMO_HIT_COLOR = 6;
const LEVEL_AMMO_HIT_COUNT = 7;
const LEVEL_AMMO_HIT_SIZE = 8;
const LEVEL_BACKGROUND_PARTS = 9;
const LEVEL_COLORS = 10;

let currentLevelIndex = 1;
let currentLevel = levels[currentLevelIndex];
let boxes = [];
let bullets = [];
let constraints = [];
let wires = [];
let particles = [];
let messageBubbles = [];
let specialParticles = [];
let gameOver;
let win;
let offset;
let lastBox;
let lastPos;
let lastLastBox;
let lastWire;
let score = 0;
let killCount;
let specialStrength;
let restartMessage = 'CLICK TO RESTART';
let newLevelTimeout;
let hasStarted = false;
let aimerX;
let aimerY;
let aimerAngle;
let mouseX = 0;
let mouseY = 0;

function setup () {
  boxes = [];
  bullets = [];
  constraints = [];
  wires = [];
  particles = [];
  messageBubbles = [];
  specialParticles = []
  gameOver = false;
  win = false;
  offset = 0;
  killCount = 0;
  specialStrength = 0;
  for (let i=0; i<3; i++) {
    addWire();
  }
  wires[0].constraints = null;
  wires[0].points = null;
  wires.splice(0,1);
}

function beginMessage () {
  renderBackground(0);
  context.save();
  context.fillStyle = '#FFF';
  context.font = '160px Impact';
  context.setTransform(1,-0.07,-0.3,1,0,0);
  context.fillText('TAKE THE', 270, 300);
  context.setTransform(1.1,-0.07,-0.2,1,0,0);
  context.fillText('NETWORK', 225, 432);
  context.setTransform(1.1,-0.07,-0.2,1,0,0);
  context.fillText('OFFLINE!', 225, 567);
  context.font = '32px Impact';
  context.fillText('Use your mouse to aim, space to fire, click for special.', 225, 602);
  context.restore();
}

function showMessage (line1, line2, line3) {
  context.save();
  context.fillStyle = '#000';
  drawMessageText(line1, line2, line3);
  context.fillStyle = '#FFF';
  drawMessageText(line1, line2, line3);
  context.restore();
}

function drawMessageText (line1, line2, line3) {
  context.font = '160px Impact';
  context.setTransform(1,-0.07,-0.3,1,0,0);
  context.fillText(line1, 270, 300);
  context.setTransform(1.1,-0.07,-0.2,1,0,0);
  context.fillText(line2, 225, 432);
  context.font = '60px Impact';
  context.fillText(line3 || restartMessage, 225, 492);
}

function drawCircle (context, x, y, r, color) {
  context.beginPath();
  context.arc(x, y, r, 0, Math.PI * 2, true);
  context.closePath();
  context.fillStyle = color||'#000';
  context.fill();
}

function addWire() {
  let x = range(16,width-16);
  let y = 0; // range(0,height/10);
  let pos = new Vec2(x,y);
  let wire = new Rope(pos,30,5);
  wire.position.vy = range(currentLevel[LEVEL_GENERATION_SPEED]/2,currentLevel[LEVEL_GENERATION_SPEED]);
  let box = new Square(pos,0);
  if (int(6) === 0) {
    box.magic = true;
  }

  if (lastBox) {
    wire.attach(box.points[0]);
    let otherBox = lastBox; //boxes[boxes.length-1] || lastBox;
    otherBox = (otherBox.points && otherBox.points[0]) ? otherBox : lastBox;
    if (otherBox && otherBox.wires && otherBox.wires[0]) {
      wire.attachEnd(otherBox.constraints[0].P1);
      wire.connections.push(box,otherBox);
      otherBox.wires = otherBox.wires || [];
      otherBox.wires.push(wire);
    }
    box.wires = box.wires || [];
    box.wires.push(wire);
    wires.push(wire);
    lastLastBox = lastBox;
    lastPos = pos;
  }
  boxes.push(box);
  lastBox = box;
  lastWire = wire;
}

// https://krazydad.com/tutorials/makecolors.php
function makeColors(frequency1, frequency2, frequency3, phase1, phase2, phase3, center, width, len) {
  center = center || 128;
  width = width || 127;
  len = len || 10;
  const result = [];
  for (let i = 0; i < len; ++i) {
    const red = Math.sin(frequency1*i + phase1) * width + center;
    const green = Math.sin(frequency2*i + phase2) * width + center;
    const blue = Math.sin(frequency3*i + phase3) * width + center;
    result.push(rgbToHex(red,green,blue));
  }
  return result;
}

function rgbToHex(r, g, b) {
  return "#" + ((((1 << 24) + (r << 16) + (g << 8) + b))|0).toString(16).slice(1);
}

function renderBackground(time) {
  context.fillStyle = currentLevel[LEVEL_COLORS][0];
  context.fillRect(0,0,width,height);
  context.save();
  context.setTransform(1,0.1,-0.1,1,0,0);
  const offsetX = offset/2;
  const offsetY = offset/1000;
  const overdraw = 400;
  let parts = currentLevel[LEVEL_BACKGROUND_PARTS];
  for(let i=0;i<parts;i++){
    context.fillStyle = currentLevel[LEVEL_COLORS][i];
    context.beginPath();
    let y = (height/parts)*i;
    context.moveTo(0,y+overdraw+offsetY);
    context.lineTo(0,y+offsetY);
    let chunks = 5;//rangeInt(3,10);
    for(let j=0;j<chunks+10;j++){
      let x = ((width/chunks)*j)+(i%2?-offsetX:offsetX) - 1000;
      if (x > -overdraw && x < width + overdraw) {
        context.quadraticCurveTo(x-(width/chunks/2),y+((j%2)?-30:30)+offsetY,x,y+offsetY);
      }
    }
    context.lineTo(width+overdraw,y);
    context.lineTo(width+overdraw,y+overdraw+offsetY);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function update(time) {
  let i;
  let last;
  if (killCount < currentLevel[LEVEL_LENGTH]) {
    score++;
    offset++;
    specialStrength += 1;
	  // context.clearRect(0, 0, canvas.width, canvas.height);
    renderBackground(time);
    for(i=0;i<bullets.length;i++) {
      let bullet = bullets[i];
      context.save();
      context.translate(bullet.x-16, bullet.y-16);
      context.rotate(bullet.r+Math.PI);
      context.drawImage(texture, 32 * currentLevel[LEVEL_AMMO_TEXTURE],0, 32, 32, 0, 0, 32, 32);
      context.restore();
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
    }
    context.save();
    context.translate(width / 2, height-16);
    context.rotate(aimerAngle+Math.PI);
    context.drawImage(texture,32*currentLevel[LEVEL_GUN_TEXTURE],0,32,32,-16,-16,32,32);
    context.restore();
  }

  if (newLevelTimeout) {
    showMessage('','   LEVEL'+currentLevelIndex,' ');
  }

  renderSpecial(context);
  renderParticles(context);
  let lastWire = null;
  wireLoop: for(i=0;i<wires.length;i++) {
    let wire = wires[i];
    wire.position.y += wire.position.vy;
    if (wire.position.x < width/2) {
      wire.position.x += 0.25;
    } else {
      wire.position.x -= 0.25;
    }

    wire.updatePoints();
    if (wire.position.y > height-16 && !win) { // ?
      gameOver = true;
      showMessage('GAME','OVER');
      sounds[2].play();
    }
    for(let k=0;k<bullets.length;k++) {
      let bullet = bullets[k];
      if (bullet) {
        for(var point of wire.points) {
          const a = bullet.x - point.position.x;
          const b = bullet.y - point.position.y;
          if (Math.sqrt( a*a + b*b ) < 10) {
            score += time/1000|0;
            killCount++;
            if (killCount === currentLevel[LEVEL_LENGTH]) {
              for(let m=0;m<wires.length;m++) {
                wires[m].constraints.shift();
              }
              nextLevel();
            } else {
              hit(bullet.x,bullet.y);
              addWire();
              if (k%3) {
                addWire();
              }
            }
            let isMagic = false;
            wire.connections.forEach((box)=>{
              boxes.splice(boxes.indexOf(box),1);
              box.hit = true;
              if (box.magic) {
                score += 1000;
                messageBubble('+1000', bullet.x, bullet.y);
                isMagic = true;
              }

              //  was trying to delete networks with one node, not working yet, without taking out everything
              // box.wires.forEach((w)=>{
                // console.log(w.connections.indexOf(box));
                // if (w.connections.indexOf(box) === 0) {
                //   w.constraints = null;
                //   w.points = null;
                //   wires.splice(wires.indexOf(w),1);
                // }
                // w.constraints = null;
                // w.points = null;
                // setTimeout(() => {
                //   wires.splice(wires.indexOf(w),1);
                //   w.hit = true;
                // },100);
              //});
            });
            if (!isMagic) {
              messageBubble('+100', bullet.x, bullet.y);
            }
            wire.constraints = null;
            wire.points = null;
            wires.splice(i,1);
            bullets.splice(k,1);
            wire.hit = true;
            sounds[0].play();
            i--;
            k--;
            continue wireLoop;
          }
    		}
      }
    }

    if (!wire.hit) {
      for(let j=0;j<5;j++) { // more loops = more precision, but worse performance
        wire.updateConstraints();
    	}
      wire.render(context);

      // complete drawing the lines between the connected boxes
      if (lastWire && lastWire.connections[0] && ~lastWire.connections[0].wires.indexOf(wire)) {
        context.beginPath();
        context.moveTo(...wire.constraints[wire.constraints.length-1].P2.position);
        context.lineTo(...lastWire.constraints[0].P1.position,5,5);
        context.closePath();
        context.stroke();
      }

      if (killCount < currentLevel[LEVEL_LENGTH]) {
        if (wire.connections && wire.connections[1] && wire.connections[1].magic) {
          context.drawImage(texture,32,0,32,texture.height,wire.points[0].position.x-16,wire.points[0].position.y-16,32,texture.height);
        } else {
          context.drawImage(texture,32*rangeInt(0,3),0,32,texture.height,wire.points[0].position.x-16,wire.points[0].position.y-16,32,texture.height);
        }
      }
    }
    lastWire = wire;
  }

  renderMessageBubles(context);
  if (win && !gameOver) {
    showMessage("NETWORK","DESTROYED","WE ARE OFFLINE!");
  }
  context.drawImage(aim,mouseX-16,mouseY-16);
  context.save();
  context.fillStyle = '#FFF';
  renderScore();
  context.fillStyle = '#000';
  context.translate(-2,-2);
  renderScore();
  context.restore();

  if (!gameOver) {
    requestAnimationFrame(update);
  }

}

function renderScore(){
  context.font = '20px Impact';
  context.setTransform(1,0,-0.1,1,0,0);
  let s = 'SCORE: ' + score;
  context.fillText(s, 20, 35);
  if (!gameOver) {
    s = 'LEVEL: ' + currentLevelIndex;
    context.fillText(s, width - 10 - context.measureText(s).width, 35);
    s = 'OFFLINE: '+(((killCount / currentLevel[LEVEL_LENGTH])*100)|0) + '%';
    context.fillText(s, width/2 - context.measureText(s).width/2, 35);
  }
}

function nextLevel () {
  if (++currentLevelIndex === levels.length) {
    win = true;
    setTimeout(()=>{
      gameOver = true;
      renderBackground(0);
      showMessage("YOU","WIN!");
      sounds[1].play();
    }, 5000);
  } else {
    newLevelTimeout = setTimeout(()=>{
      newLevelTimeout = null;
    },1000);
    currentLevel = levels[currentLevelIndex];
    setup();
  }
}

//Mousemove functions.
canvas.onmousemove = function(event) {
  aimerX = width/2;
  aimerY = height;
  mouseX = event.clientX;
  mouseY = event.clientY;
  aimerAngle = Math.atan2(
    aimerY - event.clientY,
    // event.clientX - aimerX // reverse
    Math.abs(event.clientX-width) - aimerX
  );
  if (aimerAngle < 0) {
    aimerAngle += Math.PI*2;
  }
};

function special(){
  let i;
  let points = [];
  for(i=0;i<rangeInt(Math.min(boxes.length*(specialStrength/1000),boxes.length)|0,boxes.length); i++) {
    boxes.shift();
  }
  for(i=0;i<rangeInt(Math.min(constraints.length*(specialStrength/1000),constraints.length)|0,constraints.length); i++) {
    constraints.shift();
  }
  for(i=0;i<rangeInt(Math.min(wires.length*(specialStrength/1000),wires.length)|0,wires.length); i++) {
    wires.shift();
    points.push({x:wires[i].points[0].position.x, y:wires[i].points[0].position.y});
  }
  const speed = 7;
  for (let i=0;i<40;i++) {
    specialParticles.push({
      x: mouseX,
      y: mouseY,
      vx: range(-speed,speed),
      vy: range(-speed,speed),
      a: 0.5
    });
  }
  specialStrength = 0;
}

function renderSpecial(context){
  // specialParticles
  context.fillStyle = '#F00';
  for(let i=specialParticles.length-1;i>=0;i--) {
    let particle = specialParticles[i];
    particle.vx *= 0.98; // friction
    particle.vy *= 0.98; // friction
    particle.a *= 0.85; // alpha
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.a < 0) { //  remove particles if alpha is invisible
      specialParticles.splice(i,1);
      continue;
    }
    context.globalAlpha = particle.a;
    const color = '#000000';//[COLOR.BRICK,COLOR.PINK,COLOR.GOLD][int(0,2)];
    const size = width*(specialStrength/1000);
    drawCircle(context, particle.x, particle.y, range(size*2,size*6), color);
  }
  context.globalAlpha = 1;
}

function hit(x, y) {
  const speed = 7;
  for (let i=0;i<currentLevel[LEVEL_AMMO_HIT_COUNT];i++) {
    particles.push({
      x: x,
      y: y,
      vx: range(-speed,speed),
      vy: range(-speed,speed),
      a: 1
    });
  }
}

function invertColor (color) { // not correct but it's something
  return '#'+(0xffffff ^ parseInt(color.substr(1,6),16)).toString(16);
}

function renderParticles (context) {
  context.fillStyle = invertColor(currentLevel[LEVEL_COLORS][currentLevel[LEVEL_AMMO_HIT_COLOR]]);
  for(let i=particles.length-1;i>=0;i--) {
    let particle = particles[i];
    particle.vx *= 0.98; // friction
    particle.vy *= 1.5; // friction + gravity
    particle.a *= 0.97; // alpha
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.a < 0) { //  remove particles if alpha is invisible
      particles.splice(i,1);
      continue;
    }
    context.globalAlpha = particle.a;
    let size = currentLevel[LEVEL_AMMO_HIT_SIZE];
    context.fillRect(particle.x-(size/2), particle.y-(size/2), size, size);
  }
  context.globalAlpha = 1;
}

function messageBubble (message, x, y) {
  messageBubbles.push({
    x: x,
    y: y,
    vy: range(-1,-3),
    a: 1,
    text: message
  });
}

function renderMessageBubles (context) {
  context.strokeStyle = '#000';
  context.font = '20px Impact';
  for(let i=messageBubbles.length-1;i>=0;i--) {
    let bubble = messageBubbles[i];
    bubble.vy *= 1.1; // friction + gravity
    bubble.a *= 0.97; // alpha
    // bubble.x += bubble.vx;
    bubble.y += bubble.vy;
    if (bubble.a < 0) { //  remove particles if alpha is invisible
      messageBubbles.splice(i,1);
      continue;
    }
    context.globalAlpha = bubble.a;
    context.fillStyle = '#FFF';
    context.fillStyle = '#000';
    context.fillText(bubble.text, bubble.x-40, bubble.y-20);
  }
  context.globalAlpha = 1;
}

function degToRad(angle) {
	return angle * (Math.PI / 180);
}

function radToDeg(angle) {
  return angle * (180 / Math.PI);
}

window.onkeyup = function(event) {
  if (killCount > currentLevel[LEVEL_LENGTH]) {
    return;
  }
  const speed = -currentLevel[LEVEL_AMMO_RATE];
  for (let i=0;i<currentLevel[LEVEL_AMMO_COUNT];i++){
    const variance = currentLevel[LEVEL_AMMO_COUNT]/10;
    const angle = aimerAngle + range(-variance,variance);
    bullets.push({
      x: width/2,
      y: height,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      r: angle
    });
  }
}

canvas.onclick = function(){
  if (!hasStarted) {
    hasStarted = true;
    update();
  } else if (gameOver) {
    currentLevelIndex = 1;
    currentLevel = levels[currentLevelIndex];
    setup();
    score = 0;
    requestAnimationFrame(update);
  } else {
    special();
  }
}

setup();
texture.onload = beginMessage;
texture.src = 't.png';
