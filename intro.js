document.addEventListener("DOMContentLoaded", () => {
    // Check if we are on the main page where the intro should appear
    if (!document.querySelector('.hero')) return;

    // Check if intro has already played in this session to not annoy the user,
    // although for a WOW effect presentation you might want it every time.
    // Uncomment the next lines if it should only play once per session:
    // if (sessionStorage.getItem("introPlayed")) return;
    // sessionStorage.setItem("introPlayed", "true");

    const overlay = document.createElement("div");
    overlay.id = "intro-overlay";
    document.body.prepend(overlay);
    document.body.style.overflow = "hidden"; // Prevent scrolling during intro

    // Matter.js modules
    const Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Bodies = Matter.Bodies,
        Composite = Matter.Composite,
        Events = Matter.Events,
        Body = Matter.Body,
        Constraint = Matter.Constraint,
        Vector = Matter.Vector;

    const engine = Engine.create();
    const world = engine.world;
    engine.world.gravity.y = 0; // No gravity initially

    const width = window.innerWidth;
    const height = window.innerHeight;

    const domBodies = [];

    // 1. Fill the screen with "CLINK" Text Bodies
    const fontSize = Math.max(30, width / 15);
    const cols = Math.floor(width / (fontSize * 3.5)) + 2;
    const rows = Math.floor(height / (fontSize * 1.5)) + 2;

    for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
            const offsetX = (j % 2 === 0) ? 0 : fontSize * 1.5;
            const x = i * (fontSize * 3.5) + offsetX;
            const y = j * (fontSize * 1.5);

            const el = document.createElement("div");
            el.textContent = "CLINK";
            el.className = "intro-text-element";
            el.style.fontSize = fontSize + "px";
            overlay.appendChild(el);

            const rectWidth = fontSize * 3.2;
            const rectHeight = fontSize * 1.1;

            const body = Bodies.rectangle(x, y, rectWidth, rectHeight, {
                restitution: 0.6,
                frictionAir: 0.08,  // Slows down naturally when hit
                density: 0.0005, // Lighter text
                chamfer: { radius: 10 }
            });

            Composite.add(world, body);
            domBodies.push({ body, el });
        }
    }

    // 2. Create the Logo Body
    const logoEl = document.createElement("img");
    logoEl.src = "assets/images/clink-white.webp"; // Changed to wide logo
    logoEl.className = "intro-logo-element";
    const logoWidth = Math.min(450, width * 0.8); // Make it a bit wider
    const logoHeight = logoWidth * 0.3; // Estimated height for wide logo
    logoEl.style.width = logoWidth + "px";
    overlay.appendChild(logoEl);

    const startX = width / 2;
    const startY = -logoHeight; // Start above screen

    // Use a rectangle instead of a circle for the wide logo
    const logoBody = Bodies.rectangle(startX, startY, logoWidth * 0.9, logoHeight * 0.9, {
        restitution: 0.3,
        frictionAir: 0.005,
        density: 2.0, // Extremely heavy to plow through
        chamfer: { radius: 10 }
    });

    Composite.add(world, logoBody);
    domBodies.push({ body: logoBody, el: logoEl, isLogo: true });

    // 3. Invisible walls to keep text on screen initially
    const wallOptions = { isStatic: true, render: { visible: false } };
    const ground = Bodies.rectangle(width / 2, height + 800, width * 3, 200, wallOptions);
    const leftWall = Bodies.rectangle(-200, height / 2, 200, height * 4, wallOptions);
    const rightWall = Bodies.rectangle(width + 200, height / 2, 200, height * 4, wallOptions);
    Composite.add(world, [ground, leftWall, rightWall]);

    // Start engine
    const runner = Runner.create();
    Runner.run(runner, engine);

    let phase = 0; // 0: Logo falling, 1: Hit Center, 2: Dropping all together

    // Give logo an initial downward kick
    setTimeout(() => {
        Body.setVelocity(logoBody, { x: 0, y: 15 });
    }, 100);

    Events.on(engine, 'beforeUpdate', () => {
        // Sync DOM elements to Matter.js bodies
        for (const item of domBodies) {
            const pos = item.body.position;
            const angle = item.body.angle;

            // Offset by half width/height to center the DOM element on the body
            const elWidth = item.el.offsetWidth || (item.isLogo ? logoWidth : fontSize * 3.2);
            const elHeight = item.el.offsetHeight || (item.isLogo ? logoHeight : fontSize * 1.1);

            item.el.style.transform = `translate(${pos.x - elWidth / 2}px, ${pos.y - elHeight / 2}px) rotate(${angle}rad)`;
        }

        // Phase Logic
        if (phase === 0) {
            // Guarantee minimum downward speed so it never gets stuck
            if (logoBody.velocity.y < 8) {
                Body.setVelocity(logoBody, { x: logoBody.velocity.x, y: 8 });
            }

            // Apply constant downward force to simulate heavy gravity on the logo alone
            Body.applyForce(logoBody, logoBody.position, { x: 0, y: 3.0 });

            // Check if logo hit the middle of the screen
            if (logoBody.position.y >= height / 2) {
                phase = 1;

                // Stop the logo in its tracks for a dramatic "Hit" effect
                Body.setVelocity(logoBody, { x: 0, y: 0 });
                Body.setStatic(logoBody, true);

                setTimeout(() => {
                    // "fallen text und logo insgesamt als ein großes element ... nach unten"

                    Body.setStatic(logoBody, false);
                    Composite.remove(world, [ground, leftWall, rightWall]); // Remove walls

                    // Weld everything to the logo to act as a single rigid body
                    const rigidConstraints = [];
                    for (let i = 0; i < domBodies.length; i++) {
                        if (domBodies[i].isLogo) continue;

                        const b = domBodies[i].body;
                        const dist = Vector.magnitude(Vector.sub(logoBody.position, b.position));

                        rigidConstraints.push(Constraint.create({
                            bodyA: logoBody,
                            bodyB: b,
                            stiffness: 1, // Rigid connection
                            length: dist,
                            render: { visible: false }
                        }));

                        // Reset velocities to prevent erratic spinning
                        Body.setVelocity(b, { x: 0, y: 0 });
                        Body.setAngularVelocity(b, 0);
                    }
                    Composite.add(world, rigidConstraints);

                    // Add a tiny bit of angular velocity to rotate the whole monolithic block
                    Body.setAngularVelocity(logoBody, (Math.random() > 0.5 ? 1 : -1) * 0.02);

                    // Activate global gravity
                    engine.world.gravity.y = 1.5;

                    phase = 2; // Falling down phase

                    // Clean up after it falls out of view
                    setTimeout(() => {
                        overlay.style.opacity = "0";
                        document.body.style.overflow = "auto";
                        setTimeout(() => {
                            Runner.stop(runner);
                            Engine.clear(engine);
                            overlay.remove();
                        }, 800);
                    }, 500);

                }, 400); // 400ms freeze in the center
            }
        }
    });

    // Handle Resize roughly (better to just let it overflow than rebuild physics)
    window.addEventListener('resize', () => {
        if (phase === 2) return;
        Body.setPosition(ground, { x: window.innerWidth / 2, y: window.innerHeight + 100 });
        Body.setPosition(rightWall, { x: window.innerWidth + 100, y: window.innerHeight / 2 });
    });
});
