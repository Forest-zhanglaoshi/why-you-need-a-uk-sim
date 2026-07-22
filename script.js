const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const menuButton = document.querySelector('.menu-button');
const navPanel = document.querySelector('.nav-panel');
const panelScrim = document.querySelector('.panel-scrim');
let physicsController = null;

function setPanel(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  navPanel.setAttribute('aria-hidden', String(!open));
  navPanel.classList.toggle('open', open);
  panelScrim.hidden = !open;
  document.body.classList.toggle('panel-open', open);

  if (physicsController) {
    const panelWidth = Math.min(460, window.innerWidth * 0.84);
    const target = open
      ? physicsController.heroWidth - panelWidth - 22
      : physicsController.heroWidth + 30;
    physicsController.moveRightWall(target, 480);
  }
}

menuButton.addEventListener('click', () => {
  setPanel(menuButton.getAttribute('aria-expanded') !== 'true');
});

panelScrim.addEventListener('click', () => setPanel(false));

navPanel.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setPanel(false));
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    setPanel(false);
    menuButton.focus();
  }
});

function initTangentialRotor(button) {
  if (!button || reducedMotion.matches) return;
  const svg = button.querySelector('svg');
  let angle = 0;
  let velocity = 0;
  let lastX = null;
  let lastY = null;
  let hovering = false;

  function loop() {
    velocity *= hovering ? 0.97 : 0.94;
    if (Math.abs(velocity) > 0.01) {
      angle += velocity;
      svg.style.transform = `rotate(${angle}deg)`;
    }
    requestAnimationFrame(loop);
  }

  button.addEventListener('mouseenter', (event) => {
    hovering = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });

  button.addEventListener('mouseleave', () => {
    hovering = false;
    lastX = null;
    lastY = null;
  });

  button.addEventListener('mousemove', (event) => {
    if (lastX === null) {
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }

    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    const distance = Math.hypot(dx, dy) + 0.001;
    const movementX = event.clientX - lastX;
    const movementY = event.clientY - lastY;
    const tangential = (-dy * movementX + dx * movementY) / distance;

    velocity += tangential * 0.18;
    velocity = Math.max(-18, Math.min(18, velocity));
    lastX = event.clientX;
    lastY = event.clientY;
  });

  requestAnimationFrame(loop);
}

function initHeroPhysics() {
  if (reducedMotion.matches || typeof window.Matter === 'undefined') {
    document.documentElement.classList.remove('can-motion');
    return;
  }

  const { Engine, Bodies, Body, Composite, Runner, Mouse, MouseConstraint, Events } = window.Matter;
  const hero = document.getElementById('top');
  const illustrationLayer = hero.querySelector('.hero-illustrations');
  const svgElements = Array.from(illustrationLayer.querySelectorAll('.physics-shape'));
  const heroWidth = hero.offsetWidth;
  const heroHeight = hero.offsetHeight;
  const mobile = heroWidth < 760;

  const configs = mobile
    ? [
        { radius: 56, x: 0.12, y: -260, bounce: 0.29, air: 0.018 },
        { radius: 42, x: 0.34, y: -380, bounce: 0.42, air: 0.024 },
        { radius: 50, x: 0.56, y: -310, bounce: 0.34, air: 0.02 },
        { radius: 36, x: 0.76, y: -450, bounce: 0.38, air: 0.024 },
        { radius: 38, x: 0.88, y: -290, bounce: 0.48, air: 0.026 },
        { radius: 22, x: 0.48, y: -120, bounce: 0.55, air: 0.014 },
      ]
    : [
        { radius: 78, x: 0.13, y: -330, bounce: 0.29, air: 0.014 },
        { radius: 55, x: 0.34, y: -480, bounce: 0.42, air: 0.022 },
        { radius: 68, x: 0.55, y: -360, bounce: 0.34, air: 0.017 },
        { radius: 50, x: 0.74, y: -540, bounce: 0.38, air: 0.021 },
        { radius: 50, x: 0.87, y: -300, bounce: 0.48, air: 0.024 },
        { radius: 26, x: 0.47, y: -160, bounce: 0.55, air: 0.014 },
      ];

  const engine = Engine.create({ gravity: { y: 0.6 } });
  const ground = Bodies.rectangle(heroWidth / 2, heroHeight + 30, heroWidth + 400, 60, {
    isStatic: true,
    friction: 0.8,
  });
  const wallLeft = Bodies.rectangle(-30, heroHeight / 2, 60, heroHeight * 3, { isStatic: true });
  const wallRight = Bodies.rectangle(heroWidth + 30, heroHeight / 2, 60, heroHeight * 3, { isStatic: true });
  Composite.add(engine.world, [ground, wallLeft, wallRight]);

  const items = svgElements.map((element, index) => {
    const config = configs[index];
    const startX = heroWidth * config.x + (Math.random() - 0.5) * 42;
    const body = Bodies.circle(startX, config.y, config.radius, {
      restitution: config.bounce,
      friction: 0.6,
      frictionAir: config.air,
      angle: (Math.random() - 0.5) * 0.7,
    });
    Composite.add(engine.world, body);

    const svgWidth = parseFloat(element.getAttribute('width')) || 100;
    const svgHeight = parseFloat(element.getAttribute('height')) || 100;
    element.style.inset = '0 auto auto 0';
    element.style.margin = '0';
    element.style.animation = 'none';
    element.style.transformOrigin = '50% 50%';
    return { element, body, svgWidth, svgHeight };
  });

  const mouse = Mouse.create(hero);
  mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
  mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.18,
      damping: 0.1,
      render: { visible: false },
    },
  });
  Composite.add(engine.world, mouseConstraint);

  Events.on(mouseConstraint, 'startdrag', () => {
    hero.style.cursor = 'grabbing';
  });
  Events.on(mouseConstraint, 'enddrag', () => {
    hero.style.cursor = 'grab';
  });

  Runner.run(Runner.create(), engine);

  let firstTick = true;
  function sync() {
    items.forEach(({ element, body, svgWidth, svgHeight }) => {
      const { x, y } = body.position;
      const scale = mobile ? 0.68 : 1;
      element.style.transform = `translate(${x - svgWidth / 2}px, ${y - svgHeight / 2}px) rotate(${body.angle}rad) scale(${scale})`;
      if (firstTick) element.style.opacity = '1';
    });
    firstTick = false;
    requestAnimationFrame(sync);
  }
  requestAnimationFrame(sync);

  physicsController = {
    heroWidth,
    moveRightWall(targetX, durationMs) {
      const fromX = wallRight.position.x;
      const start = performance.now();

      function move(now) {
        const progress = Math.min((now - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        Body.setPosition(wallRight, {
          x: fromX + (targetX - fromX) * eased,
          y: heroHeight / 2,
        });
        if (progress < 1) requestAnimationFrame(move);
      }

      requestAnimationFrame(move);
    },
  };
}

function initTextSpring(element) {
  if (!element || reducedMotion.matches) return;

  const characterStates = [];

  function splitNode(source, destination) {
    if (source.nodeType === Node.TEXT_NODE) {
      Array.from(source.textContent).forEach((character) => {
        const span = document.createElement('span');
        span.textContent = character;
        if (character === ' ' || character === '\u00a0' || character === '\n') {
          span.style.display = 'inline';
        } else {
          span.style.display = 'inline-block';
          characterStates.push({ element: span, vx: 0, vy: 0, offsetX: 0, offsetY: 0 });
        }
        destination.appendChild(span);
      });
    } else if (source.nodeName === 'BR') {
      destination.appendChild(document.createElement('br'));
    } else {
      const clone = document.createElement(source.tagName.toLowerCase());
      Array.from(source.attributes || []).forEach((attribute) => {
        clone.setAttribute(attribute.name, attribute.value);
      });
      destination.appendChild(clone);
      Array.from(source.childNodes).forEach((child) => splitNode(child, clone));
    }
  }

  const originalNodes = Array.from(element.childNodes);
  element.innerHTML = '';
  originalNodes.forEach((node) => splitNode(node, element));

  let mouseX = -999;
  let mouseY = -999;
  let pointerInside = false;
  let frameId = null;

  function tick() {
    let totalMovement = 0;

    characterStates.forEach((state) => {
      const rect = state.element.getBoundingClientRect();
      if (rect.width === 0) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = centerX - mouseX;
      const dy = centerY - mouseY;
      const distance = Math.hypot(dx, dy);
      const radius = 48;

      if (pointerInside && distance < radius && distance > 0.5) {
        const force = (1 - distance / radius) * 7.4;
        state.vx += (dx / distance) * force;
        state.vy += (dy / distance) * force;
      }

      state.vx += -state.offsetX * 0.14;
      state.vy += -state.offsetY * 0.14;
      state.vx *= 0.68;
      state.vy *= 0.68;
      state.offsetX += state.vx;
      state.offsetY += state.vy;
      totalMovement += Math.abs(state.offsetX) + Math.abs(state.offsetY);

      if (Math.abs(state.offsetX) + Math.abs(state.offsetY) > 0.04) {
        state.element.style.transform = `translate(${state.offsetX.toFixed(2)}px, ${state.offsetY.toFixed(2)}px)`;
      } else if (!pointerInside) {
        state.offsetX = 0;
        state.offsetY = 0;
        state.element.style.transform = '';
      }
    });

    if (pointerInside || totalMovement > 0.12) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = null;
    }
  }

  function startLoop() {
    if (frameId === null) frameId = requestAnimationFrame(tick);
  }

  element.addEventListener('mouseenter', () => {
    pointerInside = true;
    startLoop();
  });

  element.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    startLoop();
  });

  element.addEventListener('mouseleave', () => {
    pointerInside = false;
    mouseX = -999;
    mouseY = -999;
    startLoop();
  });
}

async function copyWechatId(button) {
  const targetId = button.dataset.copyTarget;
  const target = document.getElementById(targetId);
  const status = button.parentElement.querySelector('.copy-status');
  if (!target) return;

  const value = target.textContent.trim();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }

    button.textContent = '已复制';
    status.textContent = `微信号 ${value} 已复制`;
    window.setTimeout(() => {
      button.textContent = '复制微信号';
      status.textContent = '';
    }, 2400);
  } catch {
    status.textContent = `请手动复制：${value}`;
  }
}

window.addEventListener('load', () => {
  initTangentialRotor(menuButton);
  initHeroPhysics();
  initTextSpring(document.querySelector('.spring-text'));
  document.querySelectorAll('.copy-button').forEach((button) => {
    button.addEventListener('click', () => copyWechatId(button));
  });
});
