import React, {useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import * as d3 from 'd3';


//TODO: modify this to make a new glyph that captures both the in-plane velocity and concentration
//example function/code for making a custom glyph
//d is the data point {position, velocity,concentration}, axis is ['x','y','z'], scale is optional value to pass to help scale the object size
function makeVelocityGlyph(d,axis,scale=1){
    var xv = d.velocity[1];
    var yv = d.velocity[2];
    if(axis == 'y'){
        xv = d.velocity[0];
        yv =  d.velocity[1];
    } else if(axis == 'z'){
        xv = d.velocity[0];
    }

    let xpos = xv/scale
    let ypos = yv/scale
    // Adjust sizes based on axis
    let triangleScale = 1;
    let circleScale = 1;
    if (axis === 'y') {
        triangleScale = 1.5;  // Increase triangle size for Y axis
        circleScale = 1;    // Increase circle size for Y axis
    } else {
        circleScale = 0.5;    // Decrease circle size for X and Z axes
    }

    let path = 'M ' + (xpos * triangleScale) + ',' + (ypos * triangleScale) + ' '
        + (-ypos/3 * triangleScale) + ',' + (xpos/3 * triangleScale) + ' '
        + (ypos/3 * triangleScale) + ',' + (-xpos/3 * triangleScale) + 'z';

    // Add a circle glyph for concentration
    let circleRadius = d.concentration * scale * 2;
    path += ' M ' + xpos + ',' + ypos + ' m -' + circleRadius + ', 0 a ' + circleRadius + ',' + circleRadius + ' 0 1,0 ' + (circleRadius*2) + ',0 a ' + circleRadius + ',' + circleRadius + ' 0 1,0 -' + (circleRadius*2) + ',0';

    return path;
}

function makeCompositeGlyph(d, axis, scale=1) {
    var xv = d.velocity[1];
    var yv = d.velocity[2];
    if(axis == 'y'){
        xv = d.velocity[0];
        yv =  d.velocity[1];
    } else if(axis == 'z'){
        xv = d.velocity[0];
    }

    let xpos = xv/scale;
    let ypos = yv/scale;
    
    // Adjust sizes based on axis
    let triangleScale = 1;
    let circleScale = 1;
    if (axis === 'y') { // For Y axes
        triangleScale = 1.1;  
        circleScale = 3.5;    
    } else {  // For X and Z axes
        triangleScale = 1.2;  
        circleScale = 0.5;    
    }

    let path = 'M ' + (xpos * triangleScale) + ',' + (ypos * triangleScale) + ' '
        + (-ypos/3 * triangleScale) + ',' + (xpos/3 * triangleScale) + ' '
        + (ypos/3 * triangleScale) + ',' + (-xpos/3 * triangleScale) + 'z';

    // Add a circle glyph for concentration
    let circleRadius = d.concentration * scale * circleScale;
    path += ' M ' + xpos + ',' + ypos + ' m -' + circleRadius + ', 0 a ' + circleRadius + ',' + circleRadius + ' 0 1,0 ' + (circleRadius*2) + ',0 a ' + circleRadius + ',' + circleRadius + ' 0 1,0 -' + (circleRadius*2) + ',0';

    return path;
}


export default function LinkedViewD3(props){
    //this is a generic component for plotting a d3 plot
    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const margin = 10;
    //sets a number of the number of particles we show when the brushed area has is too large
    const maxDots = 2000;
    
    //draw the points in the brushed area
    useEffect(()=>{
        if(svg !== undefined & props.data !== undefined & props.bounds !== undefined){
            //filter data by particles in the brushed region
            const bDist = d => props.brushedCoord - props.getBrushedCoord(d);
            function isBrushed(d){
                return Math.abs(bDist(d)) < props.brushedAreaThickness;
            }
            var data = props.data.filter(isBrushed);

            const bounds = props.bounds;
            console.log('bounds',bounds)
            var xExtents = [bounds.minZ, bounds.maxZ];
            var yExtents = [bounds.minY, bounds.maxY];
            if(props.brushedAxis === 'y'){
                xExtents = [bounds.minX, bounds.maxX];
                yExtents = [bounds.minZ, bounds.maxZ];
            } else if(props.brushedAxis === 'z'){
                xExtents = [bounds.minX, bounds.maxX];
            }

            var getX = d => d.position[1];
            var getY = d => d.position[2];
            if(props.brushedAxis == 'y'){
                getX = d => d.position[0];
                getY = d => d.position[1];
            } else if(props.brushedAxis == 'z'){
                getX = d => d.position[0];
            }

            //TODO: filter out points with a concentration of less than 80% of the maximum value of the current filtered datapoints

            // Calculate the threshold value for concentration
            let maxConcentration = d3.max(data, d => d.concentration);
            let threshold = 0.5 * maxConcentration;

            // Filter the data based on the threshold
            data = data.filter(d => d.concentration >= threshold);

            // Modify the domain of the concentrationColorScale to map to concentration values
            let concentrationExtents = d3.extent(data, d => d.concentration);
            let concentrationColorScale = d3.scaleLinear()
                .domain(d3.extent(data, d => d.concentration))
                .range(props.colorRange);

            //limit the data to a maximum size to prevent occlusion
            data.sort((a,b) => bDist(a) - bDist(b));
            if(data.length > maxDots){
                data = data.slice(0,maxDots);
            }

            const getVelocityMagnitude = d => Math.sqrt(d.velocity[0]**2 + d.velocity[1]**2 + d.velocity[2]**2);
            const vMax = d3.max(data,getVelocityMagnitude);
            
            //custom radius based on number of particles
            const radius = Math.max(3*Math.min(width,height)/data.length,5);

            //scale the data by the x and z positions
            let xScale = d3.scaleLinear()
                .domain(xExtents)
                .range([margin+radius,width-margin-radius])

            let yScale = d3.scaleLinear()
                .domain(yExtents)
                .range([height-margin-radius,margin+radius])

            let colorScale = d3.scaleLinear()
                .domain(yExtents)
                .range(props.colorRange);

            

            //TODO: map the color of the glyph to the particle concentration instead of the particle height
            let dots = svg.selectAll('.glyph').data(data,d=>d.id)
            dots.enter().append('path')
                .attr('class','glyph')
                .merge(dots)
                .transition(100)
                .attr('d', d => makeCompositeGlyph(d,props.brushedAxis,.25*vMax/radius))
                .attr('fill',d=>concentrationColorScale(d.concentration))
                .attr('stroke','black')
                .attr('stroke-width',.1)
                .attr('transform',d=>'translate(' + xScale(getX(d)) + ',' + yScale(getY(d)) + ')');

            dots.exit().remove();
        }
    },[svg,props.data,props.getBrushedCoord,props.bounds])

    
    return (
        <div
            className={"d3-component"}
            style={{'height':'99%','width':'99%'}}
            ref={d3Container}
        ></div>
    );
}
