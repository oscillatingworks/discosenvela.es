$(document).mousemove(function(event) {
    windowWidth = $(window).width();
    windowHeight = $(window).height();
    
    mouseXpercentage = Math.round(event.pageX / windowWidth * 100);
    mouseYpercentage = Math.round(event.pageY / windowHeight * 100);
    
    $('.radial-gradient').css('background', 'radial-gradient(circle at ' + mouseXpercentage + '% ' + mouseYpercentage + '%, #e5f96a,4%,#7e8aed,95%,#ECECE2)');
});