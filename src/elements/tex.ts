import { Point } from "../model";
import { flattenSVG } from "../util";
import { Group, Rectangle, SVG } from "./svg";


/**
 * TeX class represents a mathematical expression rendered as SVG using MathJax
 */
export class TeX extends Group {

    private _x: number;
    private _y: number;
    private _scale: number;
    private inner: Group;
    private rendered: SVGSVGElement;

    /**
     * Constructor takes a string 's' representing the TeX to be rendered and optional 'x' and 'y' coordinates to position the SVG element
     */
    constructor(s: string, x: number, y: number) {

        super();

        if (typeof MathJax === 'undefined') {
            console.warn('MathJax is not defined. Please make sure MathJax is installed and properly loaded.');
        } else if (typeof MathJax.tex2svg !== 'function') {
            console.warn('MathJax.tex2svg is not available. Please ensure the tex2svg extension is included.');
        }

        let output = MathJax.tex2svg(s, {});
        this.rendered = output.firstChild as SVGSVGElement;

        flattenSVG(this.rendered);

        // this.rendered.classList.add('tex', 'mathjax');
        this.setAttribute('color', 'var(--font-color)');

        this.inner = this.group();
        this.inner.root.appendChild(this.rendered);

        // this._scale = 20/18;
        this._scale = 1;
        this.inner.setAttribute('transform', `scale(${this._scale})`);

        this.moveTo(x, y)

    }

    replace(s:string) : TeX {

        let output = MathJax.tex2svg(s, {});
        let rendered = output.firstChild as SVGSVGElement;
        flattenSVG(rendered);
        rendered.classList.add('tex', 'mathjax');

        this.inner.root.removeChild(this.rendered);
        this.inner.root.appendChild(rendered);
        this.rendered = rendered;
        this.drawBackground(true);
        return this;
    }

    private findSubtreeMatches(root: Element, subtree: Element): Element[][] {

        const matches: Element[][] = [];

        /**
         * Returns true if the subtree node is a deep match, meaning they have identical structure.
         */
        function nodeMatches(node: Element, subtreeNode: Element): boolean {
            if (node.tagName !== subtreeNode.tagName) {
                return false;
            }
            if (node.getAttribute('data-mml-node') !== subtreeNode.getAttribute('data-mml-node')) {
                return false;
            }
            if (node.hasAttribute('data-c') && node.getAttribute('data-c') !== subtreeNode.getAttribute('data-c')) {
                return false;
            }

            const nodeChildren = Array.from(node.children) as Element[];
            const subtreeChildren = Array.from(subtreeNode.children) as Element[];

            if (nodeChildren.length !== subtreeChildren.length) {
                return false;
            }

            for (let i = 0; i < nodeChildren.length; i++) {
                if (!nodeMatches(nodeChildren[i], subtreeChildren[i])) {
                    return false;
                }
            }

            return true;
        }

        /**
         * Traverses the tree looking for exact matching nodes and sequences of matching nodes
         */
        function traverse(node: Element) {
            Array.from(node.children).forEach((child, index, children) => {

                // Check if the child node is a deep match
                if (nodeMatches(child as Element, subtree)) {
                    matches.push([child as Element]);
                }

                // Check to see if there is a sequential match
                let currentChild: Element = child
                let currentNode: Element | null = subtree.firstChild as Element;
                let potentialMatch: Element[] = [];
                let lastMatch: Element | null = null;
                while (currentNode && currentChild && nodeMatches(currentChild as Element, currentNode)) {
                    potentialMatch.push(currentChild);
                    lastMatch = currentNode;
                    currentChild = currentChild.nextElementSibling as Element;
                    currentNode = currentNode.nextElementSibling as Element;
                }

                // If the sequence matched all of the subtrees nodes then its a match
                if (lastMatch === subtree.lastChild) {
                    matches.push(potentialMatch);
                }
            });

            Array.from(node.children).forEach(child => {
                traverse(child as Element);
            });
        }

        traverse(root);
        return matches;
    }

    setColorAll(tex: string, color: string) : TeX {
        this.getMatchesByTex(tex).forEach(matchedNodes => {
            matchedNodes.forEach(node => {
                (node as SVGSVGElement).style.fill = color;
            });
        });

        return this;
    }

    setColor(tex: string, color: string, index: number = 0): TeX {
        const matches = this.getMatchesByTex(tex);
    
        if( matches.length === 0 ) {
            throw new Error(`Found no match for: ${tex}`);
        }

        if (index < 0 || index >= matches.length) {
            throw new Error('Index is out of range');
        }
    
        matches[index].forEach(node => {
            (node as SVGSVGElement).style.fill = color;
        });
    
        return this;
    }
    

    // TODO: maybe get next match

    // TODO: ability to chain calls to getMatches

    /**
     * Returns one or more collections of elements that match the provided tex string's structure.
     */
    getMatchesByTex(tex: string): SVGElement[][] | null {

        let output = MathJax.tex2svg(tex, {});
        let matchRendered = output.firstChild as SVGSVGElement;
        flattenSVG(matchRendered);

        let tree = this.rendered.querySelector('[data-mml-node="math"]');
        let match = matchRendered.querySelector('[data-mml-node="math"]');

        return this.findSubtreeMatches(tree, match) as SVGSVGElement[][];

    }

    /**
     * Finds all SVG elements in the rendered document that correspond to a specific TeX string.
     * This method utilizes MathJax to render the TeX string to SVG and then queries the rendered output
     * for elements with specific data attributes that match the rendered TeX expression.
     *
     * @param str The TeX string to be matched in the rendered document.
     * @returns An array of SVG elements corresponding to the TeX string, or null if none are found.
     */
    getPartsByTex(str: string): SVGElement[] | null {

        // Render the sub-expression
        let output = MathJax.tex2svg(str, {});
        let rendered = output.firstChild as SVGSVGElement;

        // console.log(TreeNode.convertTreeToDOT(TreeNode.buildTree(flattenSVG(this.rendered))));

        // Extract data-c attributes
        const dataCAttributes = Array.from(rendered.querySelectorAll('[data-c]'))
            .map(el => el.getAttribute('data-c'));

        // If there are no data-c elements return null
        if (dataCAttributes.length === 0) {
            return null;
        }

        const mainContentSelectors = dataCAttributes.map(dc => `[data-c="${dc}"]`);
        const mainContentElements = mainContentSelectors.flatMap(selector =>
            Array.from(this.rendered.querySelectorAll(selector) as NodeListOf<SVGElement>)
        );

        return mainContentElements;
    }

    scale(s: number) {
        this._scale = s;
        this.inner.setAttribute('transform', `scale(${this._scale})`);
        return this;
    }

    alignCenter(): TeX {
        let bbox = this.rendered.getBoundingClientRect();
        this.inner.setAttribute('transform', `translate(${-bbox.width / 2}, ${-bbox.height / 2}) scale(${this._scale})`);
        return this;
    }

    drawBackground(replace:boolean = false) {
        let margin = 6;
        let groupBbox = this.rendered.getBoundingClientRect();
        let rectangle = new Rectangle(
            - margin / 2,
            - margin / 2,
            groupBbox.width / this._scale + margin,
            groupBbox.height / this._scale + margin
        );
        rectangle.setAttribute('fill', 'var(--background)');
        if(replace) {
            // TODO: should check that its a rect
            this.inner.root.firstChild.remove()
        }
        
        this.inner.root.prepend(rectangle.root);

        let rectbbox = rectangle.root.getBoundingClientRect();
        rectangle.x += groupBbox.x - rectbbox.x - margin / 2;
        rectangle.y += groupBbox.y - rectbbox.y - margin / 2;
    }

    shift(point: { x: number, y: number }): TeX;

    shift(x: number, y: number): TeX;

    shift(x: any, y?: any): TeX {
        let pointX, pointY;
        if (typeof x === 'object') {
            pointX = x.x;
            pointY = x.y;
        } else {
            pointX = x;
            pointY = y;
        }
        this.moveTo(this._x + pointX, this._y + pointY);

        return this;
    }

    /**
    * Moves to a point provided as an object.
    * @param point An object that represents the point to move to.
    * @returns The instance of the class for chaining.
    */
    moveTo(point: { x: number, y: number }): TeX;

    /**
    * Moves to a point provided as two separate numbers.
    * @param x The x value of the point to move to.
    * @param y The y value of the point to move to.
    * @returns The instance of the class for chaining.
    */
    moveTo(x: number, y: number): TeX;

    moveTo(x: any, y?: any): TeX {
        let pointX, pointY;
        if (typeof x === 'object') {
            pointX = x.x;
            pointY = x.y;
        } else {
            pointX = x;
            pointY = y;
        }

        this._x = pointX;
        this._y = pointY;

        this.setAttribute(
            'transform',
            `translate(${this._x}, ${this._y})`
        );
        return this;
    }
}



class TreeNode {
    parent: TreeNode | null;
    children: TreeNode[];
    element: Element | Document;

    constructor(element: Element | Document, parent: TreeNode | null = null) {
        this.element = element;
        this.parent = parent;
        this.children = [];
    }

    static buildTree(node: Element | Document, parent: TreeNode | null = null): TreeNode {
        let treeNode = new TreeNode(node, parent);

        if (node instanceof Element) {
            for (let child of Array.from(node.children)) {
                treeNode.children.push(this.buildTree(child, treeNode));
            }
        }

        return treeNode;
    }

    static convertTreeToDOT(tree: TreeNode): string {
        let dotString: string = "digraph DOMTree {\n";
        let nodeIndex: number = 0;
        let nodeLabels: Map<TreeNode, string> = new Map();

        function getLabel(node: TreeNode): string {
            if (!nodeLabels.has(node)) {
                let mml = (node.element as HTMLElement).getAttribute('data-mml-node');
                let c = (node.element as HTMLElement).getAttribute('data-c');

                let label = `${node.element.nodeName}-${mml === null ? 'c-' + c : 'node-' + mml}-${nodeIndex++}`;
                nodeLabels.set(node, label);
            }
            return nodeLabels.get(node);
        }

        function traverseTree(node: TreeNode): void {
            let nodeLabel = getLabel(node);
            if (node.parent) {
                let parentLabel = getLabel(node.parent);
                dotString += `  "${parentLabel}" -> "${nodeLabel}"\n`;
            }

            node.children.forEach(child => traverseTree(child));
        }

        traverseTree(tree);
        dotString += "}";

        return dotString;
    }


}