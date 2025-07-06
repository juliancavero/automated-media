import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PreguntaService } from './pregunta.service';
import { CreatePreguntaDto } from './dto/create-pregunta.dto';
import { UpdatePreguntaDto } from './dto/update-pregunta.dto';

@Controller('preguntas')
export class PreguntaController {
  constructor(private readonly preguntaService: PreguntaService) {}

  @Post()
  create(@Body() createPreguntaDto: CreatePreguntaDto) {
    return this.preguntaService.create(createPreguntaDto);
  }

  @Get()
  findAll() {
    return this.preguntaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.preguntaService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updatePreguntaDto: UpdatePreguntaDto,
  ) {
    return this.preguntaService.update(id, updatePreguntaDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.preguntaService.remove(id);
  }
}
