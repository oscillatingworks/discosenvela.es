$(document).mousemove(function(event) {
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    mouseYpercentage = Math.round(event.pageY / windowHeight * 100);
    sessionStorage.setItem("mouseX", mouseXpercentage);
    sessionStorage.setItem("mouseY", mouseYpercentage);

    $('.radial-gradient').css('background', `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`);
});

$(document).ready(function(event) {
    mouseXpercentage = sessionStorage.getItem("mouseX");
    mouseYpercentage = sessionStorage.getItem("mouseY");

    $('.radial-gradient').css('background', `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`);
});