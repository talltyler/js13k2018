import PointConstraint from './PointConstraint';
import Point from './Point';
import Vec2 from './Vec2';
let count = 0;
export default class Rope
{
	constructor(position,rope_points,line_segment_length)
	{
		this.index = ++count;
		this.points = [];
		this.constraints = [];
		this.connections = [];
		this.position = position;
		this.rope_points = rope_points;
		this.line_segment_length = line_segment_length;

		for(var i=0;i<rope_points;i++)
		{
			this.points.push(new Point(
				new Vec2(position.x,position.y+i*line_segment_length)
			));
		}

		for(var i=0;i<rope_points-1;i++)
		{
			this.constraints.push(
				new PointConstraint(this.points[i],this.points[i+1])
			);
		}
		this.setPinned(true);
	}
	setPinned(value)
	{
		this.pinned = value;
		this.points[0].pinned = value;
	}
	getRopeEnd()
	{
		return this.points[this.points.length-1];
	}
	attach(point)
	{
		this.constraints.unshift(new PointConstraint(this.points[0],point).setLength(this.line_segment_length));
	}
	attachEnd(point)
	{
		// this.addPoint(point)
		this.constraints.push(new PointConstraint(this.getRopeEnd(),point).setLength(this.line_segment_length));
		// this.constraints.push(new PointConstraint(this.getRopeEnd(),point).setLength(this.line_segment_length));
	}
	addPoint(point)
	{
		this.points.push(new Point(
			new Vec2(point.position.x,point.position.y+(this.points.length)*this.line_segment_length)
		));
		// this.constraints.push(
		// 	new PointConstraint(this.getRopeEnd(),point).setLength(this.line_segment_length)
		// );
	}
	updatePoints()
	{
		this.points[0].position = this.position;
		for(var point of this.points)
		{
			point.update();
		}
	}
	updateFriction()
	{
		for(var point of this.points)
		{
			point.updateFriction();
		}
	}
	updateConstraints()
	{
		for(var constraint of this.constraints)
		{
			constraint.update();
		}
	}
	render(ctx)
	{
		ctx.beginPath();
		ctx.lineTo(...this.points[0].position);
		for(var constraint of this.constraints) {
			constraint.render(ctx);
		}

		//ctx.fillRect();
		//ctx.lineTo(...this.getRopeEnd().position);

		//ctx.fillRect(...this.getRopeEnd().position,3,3);
		// ctx.fillRect(...this.points[0].position,3,3);
		// ctx.moveTo(...this.points[0].position);
		//ctx.lineTo(...this.getRopeEnd().position);
		//ctx.lineTo(...this.constraints[this.constraints.length-1].P2.position);
		//ctx.lineTo(...this.constraints[0].P1.position);

		// ctx.moveTo(...this.getRopeEnd().position);
		// ctx.lineTo(...this.points[0].position);

		//ctx.fillRect(...this.getRopeEnd().position,3,3);
		//ctx.fillRect(...this.points[0].position,3,3);
		//ctx.fillStyle = '#F00';
		//ctx.fillRect(...this.constraints[0].P1.position, 4,4);
		//ctx.fillRect(...this.constraints[0].P2.position, 4,4);
		//ctx.fillStyle = '#0F0';
		//ctx.fillRect(...this.constraints[this.constraints.length-1].P1.position, 4,4);
		//ctx.fillRect(...this.constraints[this.constraints.length-1].P2.position, 4,4);
		//ctx.lineTo(...this.constraints[this.constraints.length-1].P2.position);
		//ctx.lineTo(...this.constraints[0].P2.position);



		// if (this.connections[1]) {
		// 	//
		// 	//
		// 	//ctx.moveTo(...this.constraints[0].P2.position);
		// 	//ctx.lineTo(...this.connections[1].constraints[this.connections[1].constraints.length-1].P1.position);
		// 	//ctx.fillRect(...this.constraints[0].P2.position, 5,5);
		// 	//ctx.fillRect(...this.connections[0].constraints[this.connections[0].constraints.length-1].P1.position,5,5);
		//
		// 	ctx.fillText(this.index,...this.connections[0].constraints[0].P1.position)
		// 	ctx.fillText(this.index,...this.connections[1].constraints[this.connections[1].constraints.length-1].P1.position)
		//
		// } else {
		// 	ctx.fillText(this.index,...this.constraints[0].P1.position)
		// }



		ctx.closePath();

		ctx.stroke();
	}

}
