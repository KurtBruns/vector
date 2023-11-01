import { saveAs } from './save-as';


export enum ExportTarget {
    BROWSER = 'browser',
    ILLUSTRATOR = 'illustrator',
    FIGMA = 'figma',
}

/**
 * Computes the adjusted stroke width of an SVG element after applying its transformations.
 * The function takes into account non-uniform scaling and rotation to adjust the stroke width
 * according to the major and minor axes of the ellipse that a circle (with the original stroke width as radius)
 * would be transformed to.
 *
 * @param element - The SVG element whose adjusted stroke width needs to be computed.
 * @returns Adjusted stroke width in pixels.
 */
function computeTransformedStrokeWidth(element: SVGElement): string {
    // Extract the current transformation matrix (CTM) from the element.
    const ctm = (element as any).getScreenCTM();

    // Determine horizontal and vertical scale factors.
    const horizontalScaleFactor = Math.sqrt(ctm.a * ctm.a + ctm.c * ctm.c);
    const verticalScaleFactor = Math.sqrt(ctm.b * ctm.b + ctm.d * ctm.d);

    // Determine the original stroke width.
    const originalStrokeWidth = parseFloat(window.getComputedStyle(element).getPropertyValue('stroke-width'));

    // Use the major axis of the ellipse for the adjusted stroke width.
    const adjustedStrokeWidth = originalStrokeWidth / Math.max(horizontalScaleFactor, verticalScaleFactor);

    return `${adjustedStrokeWidth}px`;
}

export function embedMarkers(svgElement: SVGSVGElement, trimPixels = 4): void {

    const elementsWithMarkersEnd = Array.from(svgElement.querySelectorAll('line[marker-end], path[marker-end]'));
    const elementsWithMarkersStart = Array.from(svgElement.querySelectorAll('line[marker-start], path[marker-start]'));
    
    const trimPath = (el: SVGPathElement, isEnd: boolean) => {
        const totalLength = el.getTotalLength();
        if (isEnd) {
            const newEndPoint = el.getPointAtLength(totalLength - trimPixels);
            const d = el.getAttribute('d');
            // Assuming the path ends with an absolute line command like "L x,y"
            el.setAttribute('d', `${d.split('L')[0]}L ${newEndPoint.x},${newEndPoint.y}`);
        } else {
            const newStartPoint = el.getPointAtLength(trimPixels);
            // Adjust the starting point of the path
            const d = el.getAttribute('d');
            el.setAttribute('d', d.replace(/M\s?\d+\.?\d*,\s?\d+\.?\d*/, `M ${newStartPoint.x},${newStartPoint.y}`));
        }
    };

    const trimLine = (el: SVGLineElement, isEnd: boolean) => {
        const x1 = parseFloat(el.getAttribute('x1') || "0");
        const y1 = parseFloat(el.getAttribute('y1') || "0");
        const x2 = parseFloat(el.getAttribute('x2') || "0");
        const y2 = parseFloat(el.getAttribute('y2') || "0");

        const angle = Math.atan2(y2 - y1, x2 - x1);

        if (isEnd) {
            el.setAttribute('x2', String(x2 - trimPixels * Math.cos(angle)));
            el.setAttribute('y2', String(y2 - trimPixels * Math.sin(angle)));
        } else {
            el.setAttribute('x1', String(x1 + trimPixels * Math.cos(angle)));
            el.setAttribute('y1', String(y1 + trimPixels * Math.sin(angle)));
        }
    };

    const processMarker = (el, markerPosition) => {
        const markerUrl = el.getAttribute(markerPosition);
        if (!markerUrl) return;
    
        const markerId = markerUrl.replace(/^url\(#/, '').replace(/\)$/, '');
        const marker = svgElement.querySelector(`#${markerId}`);
    
        let x, y, angle, strokeWidth;
    
        switch (el.tagName.toLowerCase()) {
            case 'line':
                if (markerPosition === 'marker-end') {
                    x = parseFloat(el.getAttribute('x2') || "0");
                    y = parseFloat(el.getAttribute('y2') || "0");
                    const x1 = parseFloat(el.getAttribute('x1') || "0");
                    const y1 = parseFloat(el.getAttribute('y1') || "0");
                    angle = Math.atan2(y - y1, x - x1);
                } else {
                    x = parseFloat(el.getAttribute('x1') || "0");
                    y = parseFloat(el.getAttribute('y1') || "0");
                    const x2 = parseFloat(el.getAttribute('x2') || "0");
                    const y2 = parseFloat(el.getAttribute('y2') || "0");
                    angle = Math.atan2(y2 - y, x2 - x);
                }
                trimLine(el as SVGLineElement, markerPosition === 'marker-end');
                break;
    
            case 'path':
                // TODO: Use a more robust method to get the start/end point and angle for paths
                const d = el.getAttribute('d') || "";
                const coords = markerPosition === 'marker-end' ? d.split(/[ ,MLCZz]/).filter(Boolean).slice(-2) : d.split(/[ ,MLCZz]/).filter(Boolean).slice(0, 2);
                if (coords.length === 2) {
                    x = parseFloat(coords[0]);
                    y = parseFloat(coords[1]);
                }
                angle = 0; 
                // TODO: untested
                trimPath(el as SVGPathElement, markerPosition === 'marker-end');
                break;
    
            default:
                return;
        }
    
        if (x === undefined || y === undefined || angle === undefined) {
            console.log(`Either x, y or angle is undefined:`, x, y, angle)
        }
        
        const clonedPath = marker.firstChild.cloneNode(true) as SVGPathElement;
        const markerWidth = parseFloat(marker.getAttribute('markerWidth'));
        const markerHeight = parseFloat(marker.getAttribute('markerHeight'));
        const refX = parseFloat(marker.getAttribute('refX'));
        const refY = parseFloat(marker.getAttribute('refY'));
        
        const scale = 1.5;
        if (markerPosition === 'marker-start') {
            angle += Math.PI
        }
        const adjustedX = x - (refX * scale) * Math.cos(angle) + (refY * scale) * Math.sin(angle);
        const adjustedY = y - (refX * scale) * Math.sin(angle) - (refY * scale) * Math.cos(angle);
        clonedPath.setAttribute('transform', `translate(${adjustedX},${adjustedY}) rotate(${angle * (180 / Math.PI)}) scale(${scale})`);
    
        svgElement.appendChild(clonedPath);
        el.removeAttribute(markerPosition);
    }
    
    elementsWithMarkersEnd.forEach(el => processMarker(el, 'marker-end'));
    elementsWithMarkersStart.forEach(el => processMarker(el, 'marker-start'));
    
    
}

/**
 * Flattens the SVG by replacing <use> references with actual content from <defs>.
 */
export function flattenSVG(svgElement: SVGSVGElement): void {
    const useElements = Array.from(svgElement.querySelectorAll('use'));

    useElements.forEach(useElement => {
        const href = useElement.getAttribute('xlink:href') || useElement.getAttribute('href');
        if (!href) return;

        const originalElement = svgElement.querySelector(href);
        if (!originalElement) return;

        const clonedElement = originalElement.cloneNode(true) as SVGElement;

        // Copy attributes from <use> to the cloned element
        Array.from(useElement.attributes).forEach(attr => {
            if (attr.name !== 'xlink:href' && attr.name !== 'href') {
                clonedElement.setAttribute(attr.name, attr.value);
            }
        });

        useElement.parentNode?.replaceChild(clonedElement, useElement);
    });

    // Remove defs
    const defsElement = svgElement.querySelector('defs');
    if (defsElement) {
        defsElement.remove();
    }
}

/**
 * Converts the computed styles of the SVG to inline styles.
 * @param originalSvg The original SVG element to convert.
 * @param target The desired export target.
 * @returns A new SVG element with inline styles.
 */
function createInlineStyledSvg(originalSvg: SVGElement, target: ExportTarget): SVGSVGElement {
    const copiedSvg = originalSvg.cloneNode(true) as SVGSVGElement;
    document.body.appendChild(copiedSvg);

    function copyComputedStyles(element: SVGElement, parentElement?: Element): void {
        const elementStyles = window.getComputedStyle(element);
        const parentStyles = parentElement ? window.getComputedStyle(parentElement) : null;

        const styleAttributes = [
            'fill', 'fill-opacity', 'opacity', 
            'font', 'font-family', 'font-size',
            'stroke', 'stroke-width', 'stroke-opacity', 
            'vector-effect'
        ];

        styleAttributes.forEach((styleAttr) => {
            const elementStyleValue = elementStyles.getPropertyValue(styleAttr);
            const parentStyleValue = parentStyles?.getPropertyValue(styleAttr) || '';
            const attributeStyleValue = element.getAttribute(styleAttr);

            if (attributeStyleValue !== null) {
                element.setAttribute(styleAttr, elementStyleValue);
            } else if (elementStyleValue !== parentStyleValue) {
                element.style.setProperty(styleAttr, elementStyleValue);
            }
        });

        // Handle Illustrator and Figma specific styles.
        if ([ExportTarget.ILLUSTRATOR, ExportTarget.FIGMA].includes(target) && elementStyles.getPropertyValue('vector-effect') === 'non-scaling-stroke') {
            element.style.setProperty('stroke-width', computeTransformedStrokeWidth(element));
            element.removeAttribute('vector-effect')
            element.style.removeProperty('vector-effect')
        }

        // Handle Figma specific styles.
        if (target === ExportTarget.FIGMA && element.classList.contains('mathjax')) {
            const currentTransform = element.getAttribute('transform') || '';
            element.setAttribute('transform', `${currentTransform} scale(${4/3})`);
        }
    }

    function traverseDOMTree(node: Node, parentNode?: Element): void {
        if (node.nodeType === Node.ELEMENT_NODE) {
            let element = node as SVGElement;
            copyComputedStyles(element, parentNode);
            Array.from(element.children).forEach((child) => {
                traverseDOMTree(child, element);
            });
        }
    }

    traverseDOMTree(copiedSvg);
    document.body.removeChild(copiedSvg);

    return copiedSvg;
}


/**
 * Bundle the SVG for export
 */
export function bundle(root: SVGElement, target: ExportTarget = ExportTarget.BROWSER): string {

    const inlineSvg = createInlineStyledSvg(root, target);
    embedMarkers(inlineSvg)
    flattenSVG(inlineSvg);
    return inlineSvg.outerHTML;
}

/**
 * Downloads the current drawing as an SVG file.
 * @param root The root SVG element to save.
 * @param filename The desired filename for the saved SVG.
 * @param target The desired export target.
 */
export function download(root: SVGElement, filename: string, target: ExportTarget = ExportTarget.BROWSER): void {


    const inlineSvg = createInlineStyledSvg(root, target);

    embedMarkers(inlineSvg)
    flattenSVG(inlineSvg);

    saveSVG(filename, inlineSvg.outerHTML);
}

/**
 * Saves SVG content as a file.
 * @param filename The desired filename for the saved SVG.
 * @param data The SVG content as a string.
 */
function saveSVG(filename: string, data: string): void {
    const blob = new Blob([data], { type: 'image/svg+xml' });
    saveAs(blob, filename, {});
}

/**
 * Parses and returns the SVG documented represented by the string argument.
 * @param svg The SVG string to parse.
 * @returns The parsed SVG element.
 */
export function parseSVG(svg: string): SVGElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svg, 'image/svg+xml');
    return doc.documentElement as unknown as SVGElement;
}
