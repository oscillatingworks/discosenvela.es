document.addEventListener('DOMContentLoaded', function() {
    const bodyGradient = document.querySelector('.body-gradient');

    function updateGradientPosition(x, y) {
        bodyGradient.style.setProperty('--mouse-x', x + '%');
        bodyGradient.style.setProperty('--mouse-y', y + '%');
    }

    let ticking = false;
    document.addEventListener('mousemove', function(event) {
        if (!ticking) {
            requestAnimationFrame(function() {
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;

                const mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
                const mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

                updateGradientPosition(mouseXpercentage, mouseYpercentage);
                ticking = false;
            });
            ticking = true;
        }
    });

    document.addEventListener('click', function(event) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
        const mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

        sessionStorage.setItem("mouseX", mouseXpercentage);
        sessionStorage.setItem("mouseY", mouseYpercentage);
    });

    // Restore gradient position from session storage
    const mouseXpercentage = sessionStorage.getItem("mouseX");
    const mouseYpercentage = sessionStorage.getItem("mouseY");

    if (mouseXpercentage && mouseYpercentage) {
        updateGradientPosition(mouseXpercentage, mouseYpercentage);
    }

    bodyGradient.addEventListener('mouseenter', function() {
        document.querySelectorAll('a').forEach(function(link) {
            link.style.cursor = 'none';
        });
    });
});
