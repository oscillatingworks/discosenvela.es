document.addEventListener('mousemove', function(event) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    const mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

    document.querySelector('.body-gradient').style.background = `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`;
});

document.addEventListener('click', function(event) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    const mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

    sessionStorage.setItem("mouseX", mouseXpercentage);
    sessionStorage.setItem("mouseY", mouseYpercentage);
});

document.addEventListener('DOMContentLoaded', function() {
    const mouseXpercentage = sessionStorage.getItem("mouseX");
    const mouseYpercentage = sessionStorage.getItem("mouseY");

    if (mouseXpercentage && mouseYpercentage) {
        document.querySelector('.body-gradient').style.background = `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`;
    }
});

document.querySelector('.body-gradient').addEventListener('mouseenter', function() {
    document.querySelectorAll('a').forEach(function(link) {
        link.style.cursor = 'none';
    });
});
