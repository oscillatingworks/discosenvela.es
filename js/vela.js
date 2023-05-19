$(document).mousemove(function(event) {
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

    $('.body-gradient').css('background', `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`);
});

$(document).click(function(event) {
    windowWidth = $(window).width();
    windowHeight = $(window).height();

    mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    mouseYpercentage = Math.round(event.pageY / windowHeight * 100);

    sessionStorage.setItem("mouseX", mouseXpercentage);
    sessionStorage.setItem("mouseY", mouseYpercentage);
});

$(document).ready(function(event) {
    mouseXpercentage = sessionStorage.getItem("mouseX");
    mouseYpercentage = sessionStorage.getItem("mouseY");

    $('.body-gradient').css('background', `radial-gradient(circle at ${mouseXpercentage}% ${mouseYpercentage}%, #e5f96a,4%,#7e8aed,95%,#ECECE2)`);
});

$('.no-body-gradient').ready(function(event) {
    $('a').css({'cursor': 'pointer'})
});